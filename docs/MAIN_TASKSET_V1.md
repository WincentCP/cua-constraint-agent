# OpenApps Main Experiment — 32 Selected Tasks

**Official source:** [OpenApps task definitions (pinned commit)](https://github.com/facebookresearch/OpenApps/tree/6e6782794433c60468d65ac75bc3f03c56007f8c/config/tasks)
**Frozen selection:** [main_taskset_v1.json](../config/main_taskset_v1.json) · 2026-10-20 · task-order SHA-256 `73d4a4a8e377422072c6ab27c066f87f8acbed7683ed50168c3407c861d61333`
**Evaluation design:** 32 tasks × 4 LLMs × 2 methods (Baseline / Proposed–CDEA) = **128 matched pairs / 256 episodes**.
**Results and audit:** [Main results](MAIN_RESULTS_V1.md) · [Data provenance](DATA_PROVENANCE.md) (researcher-reported live-provenance review: **PASS**).

## Primitive control — 9 tasks

| # | Official task ID | Purpose |
|---:|---|---|
| 1 | `all_tasks/add_paper_reading_meeting_with_einstein` | Create a calendar event with several required fields and an invitee |
| 2 | `all_tasks/remove_wacv_abstract_deadline` | Find and remove a named pre-existing calendar event |
| 3 | `all_tasks/mark_visit_grandma_as_done` | Find and complete a named seeded todo |
| 4 | `all_tasks/delete_call_aunt_lisa` | Find and delete an existing seeded todo |
| 5 | `all_tasks/message_alice_about_badminton` | Compose and send a specified message to a named contact |
| 6 | `all_tasks/save_eiffel_tower_to_my_favorite_places` | Locate and save a landmark with a tight coordinate tolerance |
| 7 | `all_tasks/navigate_from_codeeditor_to_todo` | Check direct navigation between application surfaces |
| 8 | `all_tasks/edit_script_add_header_comment` | Modify and save an existing code-editor file |
| 9 | `all_tasks/create_notes_file_in_code_editor` | Create and persist a new code-editor file |

## Cross-app workflow — 18 tasks

| # | Official task ID | Purpose |
|---:|---|---|
| 10 | `longer_horizon/book_club_event_and_message_alice` | Combine calendar creation with a messenger action |
| 11 | `longer_horizon/gym_todo_and_message_bob` | Combine todo creation with messaging |
| 12 | `longer_horizon/mark_meditate_and_garden_event` | Complete an existing todo and create an event |
| 13 | `longer_horizon/remove_cpal_and_message_alice` | Remove an existing event and send a notification |
| 14 | `longer_horizon/mark_buy_groceries_and_message_bob` | Mark a seeded todo and send a related message |
| 15 | `longer_horizon/remove_times_square_and_add_todo` | Delete a saved place and create a planning todo |
| 16 | `longer_horizon/delete_update_calendar_and_message_charlie` | Delete a seeded todo and notify a contact |
| 17 | `longer_horizon/remove_central_park_and_message_bob` | Remove a saved place and notify a contact |
| 18 | `longer_horizon/conference_trip_setup` | Coordinate calendar, todo, and message creation |
| 19 | `longer_horizon/doctor_followup` | Coordinate calendar creation, todo completion, and todo creation |
| 20 | `longer_horizon/cleanup_and_new_plan` | Delete a seeded todo, create an event, and send a message |
| 21 | `longer_horizon/cancel_and_reschedule_iclr` | Remove a deadline, create a follow-up todo, and message a contact |
| 22 | `longer_horizon/remove_landmark_trip_replan` | Remove a landmark, create a todo, and schedule an event |
| 23 | `longer_horizon/delete_and_add_and_message` | Delete and add distinct todos before sending a message |
| 24 | `longer_horizon/garage_sale` | Create an event and two todos and complete an existing todo |
| 25 | `longer_horizon/deadline_swap` | Replace a named deadline and coordinate todo and message changes |
| 26 | `longer_horizon/holiday_hosting` | Create an annotated event and two todos, then send a message |
| 27 | `longer_horizon/research_pivot` | Remove two distinct deadline events and create communication follow-ups |

## Bank information (primary) — 5 tasks

| # | Official task ID | Purpose |
|---:|---|---|
| 28 | `openbanking/log_business_card_charges_as_todos` | Read two qualifying bank-card transactions and make two todos |
| 29 | `openbanking/note_pending_transfer_in_calendar_and_todo` | Retrieve a pending transaction amount for a cross-app action |
| 30 | `openbanking/reconcile_the_largest_account` | Compare account balances to identify an account for two actions |
| 31 | `openbanking/schedule_the_card_payment_due_date` | Read the payment due date and apply it in another app |
| 32 | `openbanking/report_the_card_statement_balance_and_headroom` | Disambiguate statement balance and available headroom before acting |

## Selection rules

- Original Hydra task IDs from `original_tasks.yaml`, `longer_horizon.yaml`, and `openbanking.yaml` at the pinned OpenApps commit.
- The six Pilot task IDs and goal-paraphrase variations are excluded.
- The five bank-information tasks require information retrieval before acting (**20 primary task–model pairs**); task IDs are distinct but not necessarily statistically independent.
- See the [frozen protocol](MAIN_PROTOCOL_V1.md) for validity rules and statistical limitations.
