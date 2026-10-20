# Main v1 — frozen 32-task OpenApps set (task-set freeze only)

**Frozen:** 2026-10-20. **State:** task identities frozen; **NOT** authorization to run or interpret confirmatory Main experiments.

- Source: [facebookresearch/OpenApps at pinned commit `6e6782794433c60468d65ac75bc3f03c56007f8c`](https://github.com/facebookresearch/OpenApps/tree/6e6782794433c60468d65ac75bc3f03c56007f8c/config/tasks).
- Thesis controller source at selection: `WincentCP/cua-constraint-agent` `main` commit `7f886ecd163d0483b24e048405a567f902e721de`.
- Machine-readable roster: [`config/main_taskset_v1.json`](../config/main_taskset_v1.json).
- Frozen ordered `task_group/task` SHA-256: `73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333`. Every change requires a **new** protocol/version, not an in-place revision.
- Design: **32 official task IDs × 4 exact model labels × 2 methods = 128 matched pairs / 256 episodes**. This is a planned size, not any completed run.

## Source-only selection and limits

Selection uses pinned task definitions, unique official keys, variation exclusions and operation signatures, **not** any pilot win rate or observed Main outcome. All six task IDs in `config/pilot_plan.json` are excluded. The main set contains 9 primitive/control tasks, 18 longer-horizon workflows with **18 distinct operation multisets**, and 5 OpenBanking read-before-act tasks. Exact seeded actions and evaluator targets must **never** be injected into model prompts.

One operational `family` label is assigned to each main task for traceability; this does **not** prove 32 statistically independent behavioral families. Tasks can share operation types, apps, seed state, contacts or banking accounts. In particular, bank tasks are **task-ID-held-out**, not held out at the bank database/account level. Report strata and model-level outcomes; avoid treating all episodes as independent replicates in inferential analysis.

Five banking tasks require an unknown value from the bank UI. This makes information acquisition necessary but **does not guarantee** the agent will expose two eligible probe candidates or that CDEA will change a decision. The remaining 27 tasks are controls or compound workflows; do not claim they all exercise the reranker.

## Frozen roster

| # | Hydra group / official task ID | Operational family | Goals | Stratum |
|---:|---|---|---:|---|
| 1 | `all_tasks/add_paper_reading_meeting_with_einstein` | `calendar_event_multifield` | 1 | primitive_control |
| 2 | `all_tasks/remove_wacv_abstract_deadline` | `calendar_event_deletion` | 1 | primitive_control |
| 3 | `all_tasks/mark_visit_grandma_as_done` | `todo_existing_mark_done` | 1 | primitive_control |
| 4 | `all_tasks/delete_call_aunt_lisa` | `todo_existing_delete` | 1 | primitive_control |
| 5 | `all_tasks/message_alice_about_badminton` | `messenger_known_text_send` | 1 | primitive_control |
| 6 | `all_tasks/save_eiffel_tower_to_my_favorite_places` | `map_precise_landmark_save` | 1 | primitive_control |
| 7 | `all_tasks/navigate_from_codeeditor_to_todo` | `cross_app_navigation` | 1 | primitive_control |
| 8 | `all_tasks/edit_script_add_header_comment` | `codeeditor_existing_file_edit` | 1 | primitive_control |
| 9 | `all_tasks/create_notes_file_in_code_editor` | `codeeditor_new_file_create` | 1 | primitive_control |
| 10 | `longer_horizon/book_club_event_and_message_alice` | `calendar_create_then_message` | 2 | cross_app_workflow |
| 11 | `longer_horizon/gym_todo_and_message_bob` | `todo_create_then_message` | 2 | cross_app_workflow |
| 12 | `longer_horizon/mark_meditate_and_garden_event` | `todo_mark_then_calendar_create` | 2 | cross_app_workflow |
| 13 | `longer_horizon/remove_cpal_and_message_alice` | `calendar_remove_then_message` | 2 | cross_app_workflow |
| 14 | `longer_horizon/mark_buy_groceries_and_message_bob` | `todo_mark_then_message` | 2 | cross_app_workflow |
| 15 | `longer_horizon/remove_times_square_and_add_todo` | `map_remove_then_todo_create` | 2 | cross_app_workflow |
| 16 | `longer_horizon/delete_update_calendar_and_message_charlie` | `todo_delete_then_message` | 2 | cross_app_workflow |
| 17 | `longer_horizon/remove_central_park_and_message_bob` | `map_remove_then_message` | 2 | cross_app_workflow |
| 18 | `longer_horizon/conference_trip_setup` | `calendar_todo_message_three_step` | 3 | cross_app_workflow |
| 19 | `longer_horizon/doctor_followup` | `calendar_todo_mark_three_step` | 3 | cross_app_workflow |
| 20 | `longer_horizon/cleanup_and_new_plan` | `todo_delete_calendar_message_three_step` | 3 | cross_app_workflow |
| 21 | `longer_horizon/cancel_and_reschedule_iclr` | `calendar_remove_todo_message_three_step` | 3 | cross_app_workflow |
| 22 | `longer_horizon/remove_landmark_trip_replan` | `map_remove_todo_calendar_three_step` | 3 | cross_app_workflow |
| 23 | `longer_horizon/delete_and_add_and_message` | `todo_delete_create_message_three_step` | 3 | cross_app_workflow |
| 24 | `longer_horizon/garage_sale` | `calendar_two_todos_mark_four_step` | 4 | cross_app_workflow |
| 25 | `longer_horizon/deadline_swap` | `calendar_remove_replace_todo_message_four_step` | 4 | cross_app_workflow |
| 26 | `longer_horizon/holiday_hosting` | `calendar_two_todos_message_four_step` | 4 | cross_app_workflow |
| 27 | `longer_horizon/research_pivot` | `calendar_two_removals_todo_message_four_step` | 4 | cross_app_workflow |
| 28 | `openbanking/log_business_card_charges_as_todos` | `bank_two_card_charges_to_todos` | 2 | bank_information |
| 29 | `openbanking/note_pending_transfer_in_calendar_and_todo` | `bank_pending_transfer_to_calendar_todo` | 2 | bank_information |
| 30 | `openbanking/reconcile_the_largest_account` | `bank_max_balance_account_to_message_todo` | 2 | bank_information |
| 31 | `openbanking/schedule_the_card_payment_due_date` | `bank_due_date_to_calendar_todo` | 2 | bank_information |
| 32 | `openbanking/report_the_card_statement_balance_and_headroom` | `bank_statement_headroom_to_message_todo` | 2 | bank_information |

## Selection provenance and exclusions

The Pilot v1 IDs excluded from Main are:

- `all_tasks/add_call_mom_to_my_todo`
- `all_tasks/mark_water_plants_as_done`
- `longer_horizon/plan_elena_birthday_todo_message`
- `openbanking/message_bob_the_savings_balance`
- `openbanking/add_todo_for_the_card_minimum_payment`
- `openbanking/add_todo_to_review_largest_card_charge`

Only original task IDs are allowed, not the `__casual`, `__formal`, or `__unrelated_context` paraphrases in `user_goal_variations.yaml`. `all_tasks` is the official Hydra aggregate of the original and variation sources; the exact selected IDs above come from `original_tasks.yaml`.

Source inspection confirmed the selected keys and their operation types on the pinned OpenApps commit. This is a **static source review**, not a live task suitability/evaluator verification.

## Non-negotiable gate before Main execution

1. Resolve the outstanding Pilot provenance mismatch against **unaltered local live artifacts**, or run/document a new controlled Pilot under a new ID. A structurally consistent ZIP alone is not a live acceptance test.
2. Perform one independent local official-Hydra registration, evaluator and accessible-UI inspection on representatives of *each* stratum without tuning the task roster based on scored outcomes. Any genuine unsatisfiable task requires a recorded protocol v2 revision **before** Main, not silent deletion after scoring.
3. Verify all four exact Ollama model names/digests and live matched action contracts; confirm that Baseline/CDEA see the same initial app-state hash and evaluator inputs.
4. Confirm **real comparable public information-probe opportunities and intervention divergence** on evidence tasks; zero mechanism engagement is a no-go for the proposed causal-effectiveness interpretation.
5. Freeze and preregister Main controller commit, observation/action space, model digests, max steps, timeouts, repair rules, treatment, invalid-run denominators, statistical plan and task/model order **before the first Main pair**. The Main runner is now implemented on this research branch (scripts/browsergym/main.py), but execution remains gated by docs/MAIN_PROTOCOL_V1.md; implementation does not constitute scientific authorization.

Once Main starts, preserve unsuccessful and invalid observations, never change tasks or rerun only failures, and never pool Pilot development/simulated data into confirmatory outcomes.

## Reproducibility checks

```powershell
python -m unittest discover -s tests -p test_main_taskset.py -v
$env:OPENAPPS_DIR = "$HOME\OpenApps"
python -m unittest discover -s tests -p test_main_taskset.py -v
```

The first command is a standard-library-only offline contract. When `OPENAPPS_DIR` is set, the tests additionally verify the exact pinned checkout commit and the source `task_id`, task type, and subtask-operation sequences. Neither check runs BrowserGym, Ollama, or the reward evaluator. Do **not** interpret a green contract as approval to launch Main.

**Pilot manifest safety:** the current Pilot manifest locks the thesis repository Git commit. To resume an already-started Pilot ID, use its exact original pinned commit. This freeze is prepared on a separate branch and should not be merged during an active resume of that Pilot ID.
