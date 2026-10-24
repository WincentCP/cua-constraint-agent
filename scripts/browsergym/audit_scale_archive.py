"""Read-only audit of a Scale Study archive (ZIP or directory).

Structural consistency, captured runtime metadata, and independent provenance
are separate questions. This tool never upgrades an episode to a live run.
"""
from __future__ import annotations

import argparse
from collections import Counter
import csv
import io
import json
from pathlib import Path
import re
from zipfile import BadZipFile, ZipFile

PAIRS = 256
EPISODES = 512
SUMMARIES = 64
METHODS = ("Baseline", "Proposed")
DIGEST = re.compile(r"(?:sha256:)?[0-9a-f]{64}\Z", re.IGNORECASE)


def valid_digest(value):
    return isinstance(value, str) and bool(DIGEST.fullmatch(value))


def as_bool(value):
    if isinstance(value, bool):
        return value
    if value in ("True", "true", "1"):
        return True
    if value in ("False", "false", "0"):
        return False
    return None


class Archive:
    def __init__(self, source):
        self.source = Path(source)
        self.zip = ZipFile(self.source) if self.source.is_file() else None
        if self.zip:
            names = [n for n in self.zip.namelist() if n.endswith("manifest.json")]
            candidates = [n[:-len("manifest.json")] for n in names
                          if n.count("/") <= 1]
            if len(candidates) != 1:
                raise ValueError("Archive must contain one top-level manifest.json")
            self.prefix = candidates[0]
            self.names = set(self.zip.namelist())
        else:
            if not self.source.is_dir():
                raise FileNotFoundError(source)
            self.prefix = ""
            self.names = None

    def exists(self, path):
        if self.zip:
            return self.prefix + path in self.names
        return (self.source / path).is_file()

    def read(self, path):
        if self.zip:
            return self.zip.read(self.prefix + path)
        return (self.source / path).read_bytes()

    def has_database_snapshot(self, pair_id, method):
        prefix = f"episodes/{pair_id}/{method}/server/databases/"
        if self.zip:
            return any(n.startswith(self.prefix + prefix) and
                       n.lower().endswith((".db", ".sqlite", ".sqlite3"))
                       for n in self.names)
        folder = self.source / prefix
        return folder.is_dir() and any(
            p.is_file() and p.suffix.lower() in (".db", ".sqlite", ".sqlite3")
            for p in folder.rglob("*"))

    def json(self, path):
        return json.loads(self.read(path).decode("utf-8-sig"))

    def csv(self, path):
        return list(csv.DictReader(io.StringIO(self.read(path).decode("utf-8-sig"))))

    def close(self):
        if self.zip:
            self.zip.close()


def audit(source):
    arc = Archive(source)
    try:
        required = ("manifest.json", "analysis.json", "model_digests.json",
                    "pairs.csv", "results.csv", "summary.csv")
        missing = [f for f in required if not arc.exists(f)]
        if missing:
            raise ValueError("Missing required files: " + ", ".join(missing))
        manifest = arc.json("manifest.json")
        analysis = arc.json("analysis.json")
        digests = arc.json("model_digests.json")
        pairs = arc.csv("pairs.csv")
        results = arc.csv("results.csv")
        summaries = arc.csv("summary.csv")

        counts = Counter()
        discrepancies = []
        if manifest.get("protocol") != "cdea_scale_v1":
            discrepancies.append("unexpected_protocol")
        scheduled = manifest.get("pairs", [])
        if (len(scheduled), len(pairs), len(results), len(summaries)) != (
                PAIRS, PAIRS, EPISODES, SUMMARIES):
            discrepancies.append("required_row_counts")
        # The official Scale runner serializes planned_pairs, while older
        # read-only archives may contain planned_matched_pairs. Never accept
        # disagreeing values when both are present.
        planned = manifest.get("planned_pairs", manifest.get("planned_matched_pairs"))
        if (planned != PAIRS or manifest.get("planned_episodes") != EPISODES
                or ("planned_pairs" in manifest
                    and "planned_matched_pairs" in manifest
                    and manifest["planned_pairs"] != manifest["planned_matched_pairs"])):
            discrepancies.append("manifest_planned_counts")
        if any(not isinstance(p.get("pair_id"), str) or not re.fullmatch(r"pair_[0-9]{3}", p["pair_id"]) for p in pairs):
            discrepancies.append("invalid_pair_id")
        if len({p.get("pair_id") for p in pairs}) != len(pairs):
            discrepancies.append("duplicate_pair_ids")
        if len({p.get("pair_id") for p in scheduled}) != len(scheduled):
            discrepancies.append("duplicate_manifest_pair_ids")
        if [p.get("pair_id") for p in scheduled] != [p.get("pair_id") for p in pairs]:
            discrepancies.append("manifest_pair_order_or_membership")
        if len({(r.get("pair_id"), r.get("method")) for r in results}) != len(results):
            discrepancies.append("duplicate_episode_slots")
        result_by_key = {(r.get("pair_id"), r.get("method")): r for r in results}
        for p in pairs:
            pid = p.get("pair_id")
            v = as_bool(p.get("paired_valid"))
            counts["valid_pairs" if v else "invalid_pairs"] += 1
            if v is None:
                discrepancies.append("invalid_paired_valid_value")
            for method, column in (("Baseline", "baseline_success"),
                                   ("Proposed", "proposed_success")):
                row = result_by_key.get((pid, method))
                if row is None:
                    discrepancies.append("missing_episode_slot")
                    continue
                if row.get("pair_status") != p.get("pair_status") or as_bool(row.get("paired_valid")) != v:
                    discrepancies.append("pair_episode_status_mismatch")
                if v and as_bool(row.get("paired_analysis_success")) != as_bool(p.get(column)):
                    discrepancies.append("pair_episode_success_mismatch")
            if v:
                for col, metric in (("baseline_success", "baseline_successes"),
                                    ("proposed_success", "proposed_successes")):
                    if as_bool(p.get(col)):
                        counts[metric] += 1
        if counts["valid_pairs"] + counts["invalid_pairs"] != PAIRS:
            discrepancies.append("invalid_pair_denominator")
        for k in ("valid_pairs", "invalid_pairs", "baseline_successes", "proposed_successes"):
            if analysis.get(k) != counts[k]:
                discrepancies.append("analysis_" + k)
        if analysis.get("not_started_pairs") != 0 or any(
                p.get("pair_status") == "not_started" for p in pairs):
            discrepancies.append("unexpected_unstarted_pairs")
        discrepancies = sorted(set(discrepancies))

        manifest_fields = ("created_utc", "controller_git_commit", "plan_sha256",
                           "model_config_sha256", "taskset_sha256", "model_names",
                           "model_checkpoint_digests", "openapps_git_commit")
        missing_manifest = [k for k in manifest_fields if not manifest.get(k)]
        model_names = manifest.get("model_names") or {}
        locked = manifest.get("model_checkpoint_digests") or {}
        if not isinstance(locked, dict):
            locked = {}
        if not isinstance(model_names, dict):
            model_names = {}
        labels = {m.get("label") for m in manifest.get("models", [])}
        missing_checkpoints = sorted(label for label in labels if not valid_digest(locked.get(label)))
        index = digests if isinstance(digests, dict) else {}
        if "models" in index:
            index = index["models"]
        if not isinstance(index, dict):
            index = {}
        digest_mismatches = sorted(label for label in labels
                                   if not isinstance(index.get(label), dict)
                                   or index[label].get("digest") != locked.get(label))

        episode_blockers = Counter()
        for pair in pairs:
            pid = pair.get("pair_id")
            if not isinstance(pid, str) or not re.fullmatch(r"pair_[0-9]{3}", pid):
                continue
            for method in METHODS:
                base = f"episodes/{pid}/{method}"
                path = base + "/episode/episode.json"
                if not arc.exists(path):
                    episode_blockers["missing_episode_file"] += 1
                    continue
                ep = arc.json(path)
                row = result_by_key.get((pid, method))
                if row and ep.get("official_success") != as_bool(row.get("official_success_raw")):
                    episode_blockers["episode_reward_record_mismatch"] += 1
                if ep.get("upstream_commit") != manifest.get("openapps_git_commit"):
                    episode_blockers["upstream_commit_unmatched"] += 1
                label = pair.get("model_label")
                if not valid_digest(ep.get("model_digest")) or ep.get("model_digest") != locked.get(label):
                    episode_blockers["unverified_checkpoint_identity"] += 1
                server = ep.get("server") or {}
                if server.get("execution") is False:
                    episode_blockers["execution_explicitly_false"] += 1
                if type(server.get("pid")) is not int or server["pid"] <= 0:
                    episode_blockers["missing_server_pid"] += 1
                if not isinstance(server.get("database_dir"), str) or not server["database_dir"]:
                    episode_blockers["missing_database_dir"] += 1
                if not isinstance(server.get("url"), str) or not server["url"].startswith("http"):
                    episode_blockers["missing_server_url"] += 1
                log_path = base + "/server/server.log"
                if not arc.exists(log_path) or not arc.read(log_path).strip():
                    episode_blockers["missing_server_log"] += 1
                elif b"DEMO LOG ONLY" in arc.read(log_path):
                    episode_blockers["server_log_disclaims_execution"] += 1
                if not arc.has_database_snapshot(pid, method):
                    episode_blockers["missing_database_snapshot"] += 1
        return {
            "schema_version": 1,
            "source": Path(source).name,
            "protocol": manifest.get("protocol"),
            "observed": {"pairs": len(pairs), "episodes": len(results),
                         "summary_rows": len(summaries), **dict(counts)},
            "archive_counts_consistent": not discrepancies,
            "numerical_discrepancies": discrepancies,
            "manifest_missing_runtime_contract_fields": missing_manifest,
            "checkpoint_digests_missing_or_unusable": missing_checkpoints,
            "model_digests_file_disagreements": digest_mismatches,
            "episode_runtime_evidence_blockers": dict(episode_blockers),
            "runner_contract_complete": not (missing_manifest or missing_checkpoints
                                            or digest_mismatches or episode_blockers),
            "archive_documentation_present": arc.exists("README.md"),
            "claimed_runtime_evidence_conflicts": (
                analysis.get("runtime_evidence_verified") is True and
                (manifest.get("runtime_evidence_verified") is False or
                 analysis.get("historical_experiment_runtime_evidence_verified") is False)
            ),
            "referenced_staging_report_present": (
                not (analysis.get("staging_observability") or {}).get("telemetry_report") or
                arc.exists(analysis["staging_observability"]["telemetry_report"])
            ),
            "independent_live_execution_verified": False,
            "verification_scope": (
                "Offline audit of archive contents only. This tool cannot attest "
                "that historical OpenApps processes ran, or that captured events "
                "were emitted by the original model and benchmark hosts."
            ),
        }
    finally:
        arc.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", help="Scale output directory or ZIP")
    parser.add_argument("--report", type=Path, help="Write an audit report JSON")
    parser.add_argument("--require-runtime-contract", action="store_true",
                        help="Exit with failure unless the archived runtime fields are complete")
    args = parser.parse_args(argv)
    try:
        report = audit(args.archive)
    except (ValueError, FileNotFoundError, KeyError, OSError, BadZipFile) as exc:
        parser.exit(2, "SCALE ARCHIVE AUDIT ERROR: " + str(exc) + "\n")
    output = json.dumps(report, indent=2, sort_keys=True) + "\n"
    print(output, end="")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(output, encoding="utf-8")
    if not report["archive_counts_consistent"]:
        return 2
    if args.require_runtime_contract and not report["runner_contract_complete"]:
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
