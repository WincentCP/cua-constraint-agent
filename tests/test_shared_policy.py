"""Dependency-free policy contracts for the shared BrowserGym development runner."""
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import sys
import unittest

HERE = Path(__file__).resolve().parents[1] / "scripts/browsergym"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("shared_policy", HERE / "shared_policy.py")
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def observation():
    return {"url": "http://127.0.0.1:5001/openbanking",
            "axtree_object": {"nodes": [
                {"browsergym_id": "10", "role": {"value": "link"},
                 "name": {"value": "Account A"}},
                {"browsergym_id": "20", "role": {"value": "link"},
                 "name": {"value": "Account B"}},
                {"browsergym_id": "30", "role": {"value": "textbox"},
                 "name": {"value": "Amount"}},
                {"browsergym_id": "40", "role": {"value": "button"},
                 "name": {"value": "Transfer"}},
            ]}}


TREE = "[10] link Account A\n[20] link Account B\n[30] textbox Amount\n[40] button Transfer\nAccount A has $12"
CONSTRAINTS = [{"id": "c1", "description": "Find largest charge"},
               {"id": "c2", "description": "Find available balance"}]


def reply(action=None, *, probes=None, evidence=None, decision="act"):
    obj = action or {"action": "click", "bid": "10"}
    obj = {**obj, "decision": decision}
    if probes is not None:
        obj["probes"] = probes
    if evidence is not None:
        obj["evidence"] = evidence
    return {"message": {"content": json.dumps(obj)}}


class PolicyTests(unittest.TestCase):
    def test_public_goal_is_only_source_of_constraint_descriptions(self):
        goal = "Find largest charge; then send a message to Alex"
        descriptions = policy.public_constraints(goal)
        self.assertEqual([x["id"] for x in descriptions], ["c1", "c2"])
        self.assertTrue(all(x["description"] in goal for x in descriptions))
        self.assertEqual(policy.public_constraints("Add Call Mom to my todo"),
                         [{"id": "c1", "description": "Add Call Mom to my todo"}])

    def test_same_prompt_for_methods_never_exposes_private_oracle(self):
        ledger = policy.initial_ledger(CONSTRAINTS)
        a = policy.public_messages("Find largest charge", "http://127.0.0.1:5001",
                                   TREE, {"10", "20"}, [], CONSTRAINTS, ledger)
        b = policy.public_messages("Find largest charge", "http://127.0.0.1:5001",
                                   TREE, {"10", "20"}, [], CONSTRAINTS, ledger)
        self.assertEqual(a, b)
        prompt = str(a)
        self.assertNotIn("official_reward", prompt)
        self.assertNotIn("expected_target_state", prompt)
        self.assertNotIn("method=Proposed", prompt)

    def test_policy_ranking_diverges_only_at_real_probe_opportunity(self):
        probes = [
            {"bid": "10", "progress_score": 5, "forward_cost": 4,
             "may_answer": ["c1"]},
            {"bid": "20", "progress_score": 3, "forward_cost": 1,
             "may_answer": ["c1", "c2"]},
        ]
        out = reply(probes=probes, decision="probe")
        ledger1 = policy.initial_ledger(CONSTRAINTS)
        ledger2 = policy.initial_ledger(CONSTRAINTS)
        baseline, bmeta = policy.choose_action(
            out, "Baseline", observation(), TREE, CONSTRAINTS, ledger1, 1)
        proposed, pmeta = policy.choose_action(
            out, "Proposed", observation(), TREE, CONSTRAINTS, ledger2, 1)
        self.assertEqual(baseline, 'click("10")')
        self.assertEqual(proposed, 'click("20")')
        self.assertTrue(bmeta["probe_opportunity"])
        self.assertTrue(pmeta["probe_opportunity"])
        self.assertFalse(bmeta["policy_overrode_primary"])
        self.assertTrue(pmeta["policy_overrode_primary"])

    def test_unknown_coverage_and_cost_are_stable(self):
        probes = [
            {"bid": "10", "progress_score": 5, "forward_cost": 3,
             "may_answer": ["c1"]},
            {"bid": "20", "progress_score": 2, "forward_cost": 1,
             "may_answer": ["c2"]},
        ]
        ledger = policy.initial_ledger(CONSTRAINTS)
        ledger["c1"]["state"] = "SATISFIED"
        chosen, _ = policy.choose_action(reply(probes=probes, decision="probe"),
                                          "Proposed", observation(), TREE,
                                          CONSTRAINTS, ledger, 1)
        self.assertEqual(chosen, 'click("20")')

    def test_unobserved_and_write_candidates_are_filtered(self):
        probes = [
            {"bid": "999", "progress_score": 5, "forward_cost": 1, "may_answer": ["c1"]},
            {"bid": "30", "progress_score": 5, "forward_cost": 1, "may_answer": ["c1"]},
            {"bid": "10", "progress_score": True, "forward_cost": 1, "may_answer": ["c1"]},
            {"bid": "20", "progress_score": 2, "forward_cost": 1, "may_answer": ["c1"]},
        ]
        action, meta = policy.choose_action(
            reply(probes=probes, decision="probe"), "Proposed",
            observation(), TREE, CONSTRAINTS, policy.initial_ledger(CONSTRAINTS), 1)
        self.assertEqual(action, 'click("10")')
        self.assertFalse(meta["probe_opportunity"])
        self.assertEqual([p["bid"] for p in meta["candidate_probes"]], ["20"])

    def test_no_fake_evidence_from_model_quote(self):
        ledger = policy.initial_ledger(CONSTRAINTS)
        bad_evidence = [{"constraint": "c1", "state": "SATISFIED",
                         "quote": "unseen secret bank value"},
                        {"constraint": "c2", "state": "SATISFIED", "quote": "Account A has $12"}]
        _, meta = policy.choose_action(
            reply(evidence=bad_evidence), "Baseline", observation(),
            TREE, CONSTRAINTS, ledger, 1)
        self.assertEqual(ledger["c1"]["state"], "UNKNOWN")
        self.assertEqual(ledger["c2"]["state"], "SATISFIED")
        self.assertEqual(len(meta["grounded_tentative_evidence"]), 1)
        self.assertFalse(meta["grounded_tentative_evidence"][0]["verified_correctness"])
        self.assertEqual(ledger["c2"]["observation_sha256"], sha256(TREE.encode()).hexdigest())

    def test_no_probe_means_identical_action_and_allows_fill(self):
        data = reply({"action": "fill", "bid": "30", "text": "100"})
        for method in policy.METHODS:
            chosen, meta = policy.choose_action(
                data, method, observation(), TREE, CONSTRAINTS,
                policy.initial_ledger(CONSTRAINTS), 1)
            self.assertEqual(chosen, 'fill("30", "100")')
            self.assertFalse(meta["probe_opportunity"])

    def test_submit_button_never_becomes_information_probe(self):
        probes = [
            {"bid": "40", "progress_score": 5, "forward_cost": 1,
             "may_answer": ["c1"]},
            {"bid": "10", "progress_score": 2, "forward_cost": 1,
             "may_answer": ["c1"]},
        ]
        action, meta = policy.choose_action(
            reply(probes=probes, decision="probe"), "Proposed",
            observation(), TREE, CONSTRAINTS,
            policy.initial_ledger(CONSTRAINTS), 1,
        )
        self.assertEqual(action, 'click("10")')
        self.assertFalse(meta["probe_opportunity"])
        self.assertEqual([p["bid"] for p in meta["candidate_probes"]], ["10"])

    def test_no_unresolved_public_constraints_means_no_reranking(self):
        probes = [
            {"bid": "10", "progress_score": 1, "forward_cost": 1,
             "may_answer": ["c1"]},
            {"bid": "20", "progress_score": 2, "forward_cost": 1,
             "may_answer": ["c2"]},
        ]
        ledger = policy.initial_ledger(CONSTRAINTS)
        for cell in ledger.values():
            cell["state"] = "SATISFIED"
        action, meta = policy.choose_action(
            reply({"action": "fill", "bid": "30", "text": "100"},
                  probes=probes, decision="probe"),
            "Proposed", observation(), TREE, CONSTRAINTS, ledger, 1,
        )
        self.assertEqual(action, 'fill("30", "100")')
        self.assertFalse(meta["probe_opportunity"])

    def test_invalid_primary_never_becomes_valid_through_candidates(self):
        data = reply({"action": "click", "bid": "not-present"},
                     decision="probe", probes=[
                         {"bid": "10", "progress_score": 1,
                          "forward_cost": 1, "may_answer": ["c1"]},
                         {"bid": "20", "progress_score": 1,
                          "forward_cost": 1, "may_answer": ["c2"]},
                     ])
        for method in policy.METHODS:
            with self.assertRaises(ValueError):
                policy.choose_action(data, method, observation(), TREE,
                                     CONSTRAINTS, policy.initial_ledger(CONSTRAINTS), 1)


if __name__ == "__main__":
    unittest.main()
