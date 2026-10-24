"""Small-model follow-up: 32 tasks x 4 smaller checkpoints, paired Baseline/CDEA.

Main Large outcomes are reused only by the downstream analysis notebook.
This runner never schedules the former Scale Large checkpoints.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
from types import SimpleNamespace

import matched_dev
import pilot
from ollama_preflight import find_installed_model, get_model, request_json, validate_ollama_url

ROOT = Path(__file__).resolve().parents[2]
PLAN_FILE = ROOT / "config/small_extension_plan.json"
MODELS_FILE = ROOT / "config/models_small_extension.json"
TASKSET_FILE = ROOT / "config/main_taskset_v1.json"
OUTPUT_ROOT = ROOT / "output/small_extension"
METHODS = ("Baseline", "Proposed")
COHORTS = ("bank_information", "cross_app_workflow", "primitive_control", "ALL_TASKS")
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$")
RESULT_FIELDS = ("scale_id","pair_id","task_group","task","stratum","family","model_label","size",
                 "method","pair_status","paired_valid","episode_status","episode_valid",
                 "official_success_raw","paired_analysis_success","official_reward_raw",
                 "steps","model_calls","model_seconds","probe_opportunities","policy_overrides",
                 "initial_sha256","episode_artifact","error")
PAIR_FIELDS = ("pair_id","task_group","task","stratum","family","model_label","size",
               "pair_status","paired_valid","baseline_success","proposed_success",
               "paired_delta","comparable_probe_decisions","policy_action_divergences")
SUMMARY_FIELDS = ("cohort","family","size","model_label","method","planned_pairs","valid_pairs",
                  "invalid_pairs","not_started_pairs","successes","success_rate",
                  "comparable_probe_decisions","policy_action_divergences")

def load() -> tuple[dict,list,dict]:
    return (pilot.load_object(PLAN_FILE),
            json.loads(MODELS_FILE.read_text(encoding="utf-8")),
            pilot.load_object(TASKSET_FILE))

def validate(plan, models, roster):
    if plan.get("protocol") != "cdea_small_extension_v1" or plan.get("status") != "small_only_follow_up":
        raise ValueError("Scale protocol mismatch")
    for key, val in {"seed":233, "max_steps":40, "model_timeout":240, "temperature":0,
                     "num_predict":640, "num_ctx":8192, "think":False,
                     "planned_tasks":32, "planned_matched_pairs":128,
                     "planned_episodes":256}.items():
        if plan.get(key) != val:
            raise ValueError("Scale fixed parameter mismatch: " + key)
    if plan.get("methods") != list(METHODS) or plan.get("models_file") != "config/models_small_extension.json":
        raise ValueError("Scale methods/registry mismatch")
    if plan.get("taskset_file") != "config/main_taskset_v1.json":
        raise ValueError("Taskset mismatch")
    if not isinstance(models,list) or len(models)!=4:
        raise ValueError("Small extension requires exactly four small checkpoints")
    labels=[m["label"] for m in models]
    if plan.get("model_labels") != labels or len(set(labels))!=4:
        raise ValueError("Model labels/order mismatch")
    families=plan.get("families")
    if not isinstance(families,list) or len(families)!=4 or len(set(families))!=4:
        raise ValueError("Expected four families")
    if any(not isinstance(m.get("name"),str) or not m["name"]
           or m.get("size") != "small"
           or m.get("family") not in families for m in models):
        raise ValueError("Invalid model metadata")
    if Counter(m["family"] for m in models) != Counter({f:1 for f in families}):
        raise ValueError("Exactly one small checkpoint required per family")
    if roster.get("openapps_git_commit") != plan.get("pinned_openapps_commit"):
        raise ValueError("Pinned upstream drift")
    tasks=roster.get("tasks")
    if not isinstance(tasks,list) or len(tasks)!=32:
        raise ValueError("Requires all 32 frozen task IDs")
    for task in tasks:
        if task.get("task_group") not in matched_dev.TASK_GROUPS or not task.get("task"):
            raise ValueError("Invalid official task")
    return tasks

def schedule(plan,models,tasks):
    units=[]
    for t in tasks:
        for m in models:
            units.append({"task_group":t["task_group"],"task":t["task"],
                          "stratum":t["stratum"],"family":m["family"],
                          "model_label":m["label"],"size":m["size"],
                          "order":matched_dev.pair_order(t["task"],m["label"],plan["seed"])})
    units.sort(key=lambda x:sha256(
        f'{plan["seed"]}|{x["task_group"]}/{x["task"]}|{x["model_label"]}'.encode()).hexdigest())
    for i,x in enumerate(units,1):
        x["pair_id"]=f"pair_{i:03d}"
    if len(units)!=128 or len({(x["task_group"],x["task"],x["model_label"]) for x in units})!=128:
        raise ValueError("Non-unique small-extension schedule")
    return units

def identities_for(plan,models,origin,*,client=request_json):
    base=validate_ollama_url(origin)
    tags=client(base+"/api/tags",timeout=15)
    result={}
    for m in models:
        found=find_installed_model(tags,m["name"])
        if not isinstance(found.get("digest"),str) or not found["digest"]:
            raise RuntimeError("Missing digest for "+m["label"])
        result[m["label"]]={"label":m["label"],"name":m["name"],
                            "digest":found["digest"],"ollama_url":base}
    return result

def manifest(scale_id,plan,models,roster,units,identities,repo_sha):
    return {"protocol":plan["protocol"],"scale_id":scale_id,
            "created_utc":datetime.now(timezone.utc).isoformat(),
            "controller_git_commit":repo_sha,
            "plan_sha256":pilot.hash_file(PLAN_FILE),
            "model_config_sha256":pilot.hash_file(MODELS_FILE),
            "taskset_sha256":pilot.hash_file(TASKSET_FILE),
            "openapps_git_commit":plan["pinned_openapps_commit"],
            "shared_parameters":{k:plan[k] for k in ("seed","max_steps","model_timeout",
                              "temperature","num_predict","num_ctx","think")},
            "model_checkpoint_digests":{k:v["digest"] for k,v in identities.items()},
            "model_names":{k:v["name"] for k,v in identities.items()},
            "models":models,"planned_pairs":len(units),"planned_episodes":len(units)*2,
            "pairs":units}

def inspect(folder,slot,locked):
    root=folder/"episodes"/slot["pair_id"]
    report_path=root/"pair.json"
    report=pilot.load_object(report_path) if report_path.is_file() else None
    status=report.get("status","invalid_pair") if report else (
        "unsealed_pair" if root.exists() else "not_started")
    if report and (report.get("pair_id")!=slot["pair_id"] or
                   report.get("scale_id")!=folder.name or
                   report.get("model_label")!=slot["model_label"]):
        raise RuntimeError("Sealed slot identity drift")
    records={}
    for method in METHODS:
        file=root/method/"episode"/"episode.json"
        records[method]=(pilot.load_object(file) if file.is_file() else None,file)
    def good(method):
        ep=records[method][0]
        if not ep:
            return False
        reward=ep.get("official_reward")
        success=ep.get("official_success")
        return (ep.get("mode")=="paired_scale_exploratory" and
                ep.get("study_phase")=="scale" and ep.get("scale_id")==folder.name and
                ep.get("model")==locked["name"] and ep.get("model_digest")==locked["digest"] and
                ep.get("method")==method and ep.get("task")==slot["task"] and
                ep.get("task_group")==slot["task_group"] and
                ep.get("run_complete") is True and ep.get("valid") is True and
                isinstance(reward,(float,int)) and not isinstance(reward,bool) and
                isinstance(success,bool) and success==(reward>=1.0) and
                ep.get("num_ctx")==8192 and ep.get("max_steps")==40 and
                ep.get("seed")==233 and ep.get("temperature")==0 and
                ep.get("num_predict")==640 and ep.get("think") is False and
                ep.get("upstream_commit")==matched_dev.UPSTREAM_PIN and
                isinstance(ep.get("initial_sha256"),str) and
                len(ep["initial_sha256"])==64 and
                isinstance(ep.get("trace"),list) and
                ep.get("server",{}).get("database_dir"))
    valid=(status=="paired_scale_completed" and all(good(method) for method in METHODS)
           and records["Baseline"][0]["initial_sha256"]==records["Proposed"][0]["initial_sha256"]
           and records["Baseline"][0]["server"]["database_dir"]!=records["Proposed"][0]["server"]["database_dir"]
           and report.get("initial_hash_parity") is True
           and report.get("order")==slot["order"]
           and report.get("model_identity",{}).get("digest")==locked["digest"])
    comparison={}
    if valid:
        comparison=matched_dev.comparable_decisions(
            {method:records[method][0] for method in METHODS})
        if comparison!=report.get("policy_diagnostics"):
            valid=False
            comparison={}
    rows=[]
    for method in METHODS:
        ep,file=records[method]
        ep=ep or {}
        rows.append({"scale_id":folder.name,"pair_id":slot["pair_id"],
                     **{k:slot[k] for k in ("task_group","task","stratum","family","model_label","size")},
                     "method":method,"pair_status":status,"paired_valid":valid,
                     "episode_status":ep.get("status","not_run"),"episode_valid":ep.get("valid",""),
                     "official_success_raw":ep.get("official_success",""),
                     "paired_analysis_success":ep.get("official_success") if valid else "",
                     "official_reward_raw":ep.get("official_reward",""),
                     **{k:ep.get(k,"") for k in ("steps","model_calls","model_seconds",
                                                "probe_opportunities","policy_overrides","initial_sha256")},
                     "episode_artifact":str(file.relative_to(folder).as_posix()) if file.exists() else "",
                     "error":ep.get("error","") or (report.get("error","") if report else "")})
    return {"slot":slot,"status":status,"valid":valid,"rows":rows,"comparison":comparison}

def report_outputs(folder,manifest_obj):
    views=[inspect(folder,slot,{"name":manifest_obj["model_names"][slot["model_label"]],
                                  "digest":manifest_obj["model_checkpoint_digests"][slot["model_label"]]})
           for slot in manifest_obj["pairs"]]
    results=[r for view in views for r in view["rows"]]
    pairs=[]
    for view in views:
        rows={x["method"]:x for x in view["rows"]}
        b=rows["Baseline"]["paired_analysis_success"] if view["valid"] else ""
        p=rows["Proposed"]["paired_analysis_success"] if view["valid"] else ""
        pairs.append({**{k:view["slot"][k] for k in ("pair_id","task_group","task","stratum",
                                                    "family","model_label","size")},
                      "pair_status":view["status"],"paired_valid":view["valid"],
                      "baseline_success":b,"proposed_success":p,
                      "paired_delta":int(p)-int(b) if view["valid"] else "",
                      "comparable_probe_decisions":view["comparison"].get("comparable_probe_decisions",""),
                      "policy_action_divergences":view["comparison"].get("policy_action_divergences","")})
    summaries=[]
    for cohort in COHORTS:
        for model in manifest_obj["models"]:
            for method in METHODS:
                sub=[v for v in views if v["slot"]["model_label"]==model["label"] and
                     (cohort=="ALL_TASKS" or v["slot"]["stratum"]==cohort)]
                valid=[v for v in sub if v["valid"]]
                wins=sum(bool(next(x for x in v["rows"] if x["method"]==method)["paired_analysis_success"]) for v in valid)
                summaries.append({"cohort":cohort,"family":model["family"],"size":model["size"],
                                  "model_label":model["label"],"method":method,
                                  "planned_pairs":len(sub),"valid_pairs":len(valid),
                                  "invalid_pairs":sum(v["status"] not in ("not_started","paired_scale_completed") or
                                                      (v["status"]=="paired_scale_completed" and not v["valid"]) for v in sub),
                                  "not_started_pairs":sum(v["status"]=="not_started" for v in sub),
                                  "successes":wins,"success_rate":wins/len(valid) if valid else "",
                                  "comparable_probe_decisions":sum(v["comparison"].get("comparable_probe_decisions",0) for v in valid),
                                  "policy_action_divergences":sum(v["comparison"].get("policy_action_divergences",0) for v in valid)})
    analysis={"protocol":manifest_obj["protocol"],"scale_id":folder.name,"planned_pairs":len(views),
              "valid_pairs":sum(v["valid"] for v in views),
              "invalid_pairs":sum(v["status"]!="not_started" and not v["valid"] for v in views),
              "not_started_pairs":sum(v["status"]=="not_started" for v in views),
              "status_counts":dict(Counter(v["status"] for v in views)),
              "complete":all(v["status"] in ("paired_scale_completed","invalid_pair") for v in views),
              "note":"Small checkpoints only. Main Large is supplied separately to the analysis notebook; no Large checkpoint is scheduled or inferred here."}
    pilot.atomic_csv(folder/"results.csv",RESULT_FIELDS,results)
    pilot.atomic_csv(folder/"pairs.csv",PAIR_FIELDS,pairs)
    pilot.atomic_csv(folder/"summary.csv",SUMMARY_FIELDS,summaries)
    pilot.atomic_json(folder/"analysis.json",analysis)
    return analysis

def execute(folder,manifest_obj,args,identities):
    lock=folder/".scale_running.lock"
    with lock.open("x",encoding="utf-8") as f:
        f.write("active\n")
    try:
        pilot.atomic_json(folder/"model_digests.json",{
            k:{"name":v["name"],"digest":v["digest"]} for k,v in identities.items()})
        report_outputs(folder,manifest_obj)
        n=0
        for slot in manifest_obj["pairs"]:
            if args.model_label and args.model_label!=slot["model_label"]:
                continue
            target=folder/"episodes"/slot["pair_id"]
            if (target/"pair.json").exists():
                continue
            if target.exists():
                raise RuntimeError("Unsealed pair: inspect, never silently retry "+str(target))
            if args.max_pairs and n>=args.max_pairs:
                break
            n+=1
            target.mkdir(parents=True)
            pair={"pair_id":slot["pair_id"],"scale_id":folder.name,
                  "model_label":slot["model_label"],"artifact_dir":str(target),
                  "status":"invalid_pair","initial_hash_parity":False,
                  "episodes":{},"policy_diagnostics":{}}
            opts=SimpleNamespace(openapps_dir=str(args.openapps_dir),ollama_url=args.ollama_url,
                                 models_file=str(MODELS_FILE),scale_id=folder.name,
                                 study_phase="scale",num_ctx=manifest_obj["shared_parameters"]["num_ctx"],
                                 model_label=slot["model_label"],task=slot["task"],
                                 task_group=slot["task_group"],seed=233,max_steps=40,model_timeout=240)
            try:
                current=identities[slot["model_label"]]
                matched_dev.verify_model_identity(current)
                matched_dev.run_pair(opts,pair)
                if pair.get("order")!=slot["order"] or pair["model_identity"]["digest"]!=current["digest"]:
                    raise RuntimeError("Pair order or model digest changed")
            except KeyboardInterrupt:
                pair["status"]="invalid_pair"
                pair["error"]="KeyboardInterrupt"
                raise
            except Exception as exc:
                pair["status"]="invalid_pair"
                pair["error"]=type(exc).__name__+": "+str(exc)[:1000]
            finally:
                pilot.atomic_json(target/"pair.json",pair)
                report_outputs(folder,manifest_obj)
            print(slot["pair_id"],slot["model_label"],pair["status"],flush=True)
            if args.stop_on_invalid and pair["status"]!="paired_scale_completed":
                break
    finally:
        lock.unlink(missing_ok=True)
    outcome=report_outputs(folder,manifest_obj)
    print("SMALL EXTENSION:",json.dumps({k:outcome[k] for k in ("valid_pairs","invalid_pairs","not_started_pairs")}))
    return 3 if outcome["invalid_pairs"] else 0

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    mode=p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run",action="store_true")
    mode.add_argument("--check-models",action="store_true")
    mode.add_argument("--run",action="store_true")
    p.add_argument("--extension-id", dest="scale_id")
    p.add_argument("--openapps-dir",type=Path)
    p.add_argument("--ollama-url",default="http://127.0.0.1:11434")
    p.add_argument("--model-label")
    p.add_argument("--max-pairs",type=int)
    p.add_argument("--stop-on-invalid",action="store_true")
    args=p.parse_args(argv)
    if args.run and (not args.scale_id or not ID_RE.fullmatch(args.scale_id)):
        p.error("--run requires valid --extension-id")
    if not args.run and (args.scale_id or args.max_pairs or args.stop_on_invalid):
        p.error("execution options require --run")
    if args.max_pairs is not None and not 1<=args.max_pairs<=128:
        p.error("--max-pairs must be 1..128")
    plan,models,roster=load()
    tasks=validate(plan,models,roster)
    if args.model_label and args.model_label not in plan["model_labels"]:
        p.error("Unknown small-extension model")
    units=schedule(plan,models,tasks)
    if args.dry_run:
        print("SMALL EXTENSION DRY RUN PASS: 32 tasks x 4 small checkpoints x 2 arms = 128 pairs, 256 episodes")
        print("No browser/model/server started.")
        return 0
    if args.openapps_dir is None or not (args.openapps_dir/"launch.py").is_file():
        raise RuntimeError("Pinned OpenApps checkout required")
    if pilot.git_head(args.openapps_dir)!=plan["pinned_openapps_commit"]:
        raise RuntimeError("OpenApps commit drift")
    pilot.official_task_preflight(args.openapps_dir,tasks)
    identities=identities_for(plan,models,args.ollama_url)
    if args.check_models:
        from model_compatibility import run_check
        checked=0
        for m in models:
            if args.model_label and m["label"]!=args.model_label:
                continue
            record=run_check(m["label"],args.ollama_url,models_file=MODELS_FILE,
                             num_ctx=plan["num_ctx"])
            if record["status"]!="action_contract_pass":
                raise RuntimeError("Incompatible action contract: "+m["label"])
            checked+=1
            print("ACTION CONTRACT PASS",m["label"],"probe_menu=",record["synthetic_probe_menu_demonstrated"])
        print("Checked",checked,"synthetic action contracts. No BrowserGym episodes executed.")
        return 0
    repo_sha=pilot.git_head(ROOT)
    folder=OUTPUT_ROOT/args.scale_id
    expected=manifest(args.scale_id,plan,models,roster,units,identities,repo_sha)
    if folder.exists():
        if not (folder/"manifest.json").is_file():
            raise RuntimeError("Unsealed study directory")
        existing=pilot.load_object(folder/"manifest.json")
        expected["created_utc"]=existing["created_utc"]
        pilot.assert_frozen(existing,expected)
    else:
        folder.mkdir(parents=True)
        pilot.atomic_json(folder/"manifest.json",expected)
        existing=expected
    return execute(folder,existing,args,identities)

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except (ValueError,RuntimeError,OSError,LookupError) as exc:
        print("SMALL EXTENSION BLOCKED:",type(exc).__name__,str(exc),file=sys.stderr)
        raise SystemExit(2)
