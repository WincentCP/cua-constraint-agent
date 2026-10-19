# Local isolated evaluator and Qwen gates

Run once from PowerShell (requires pinned \`$HOME\OpenApps\`, \`uv\`, Chromium,
Ollama and the model already installed):

    cd "$HOME\cua-constraint-agent"
    git pull --ff-only
    powershell -ExecutionPolicy Bypass -File .\scripts\browsergym\run_validation.ps1

No manually started OpenApps server is needed. Scripts spawn private processes
with per-run databases and logs. They only terminate their own child process.

1. The *negative* control uses official BrowserGym to add an **incorrect** Todo
   and requires evaluator reward 0.0, with no other state changes.
2. The *positive* control uses official BrowserGym to add the intended Todo and
   requires evaluator reward 1.0, with no other state changes.
3. Both controls must have identical initial cross-app hashes, yet separate
   database directories. Fail closed on a foreign server or invalid state probe.
4. Only if gates pass does a separate isolated Qwen development episode run.
   Qwen does not receive evaluator target state or private diagnostic state.

Control artifacts: \`output/browsergym/controls/<id>/report.json\`.
Qwen artifacts: \`output/browsergym/dev/<id>.json\`; launch metadata in
\`output/browsergym/isolated_qwen/<id>/report.json\`.

These are development gates, NOT Baseline/CDEA comparisons, and static CI
cannot substitute for running the live gates on the Windows research machine.
Even a successful controls gate only establishes parity for these two local
Todo episodes, not all tasks or the final study.

On any failure, inspect the corresponding report and the isolated
\`server/server.log\`. Do not proceed to the pilot until these pass and matched
Baseline/CDEA methods are implemented and evaluated.

Ownership validation parses actual `database_path` fields from OpenApps,
normalizes Windows path separators and escaped JSON, and rejects unrelated
servers or mixed database directories. CI includes Windows path regressions.

## Duplicate OpenTodos links (fixed)

A live AXTree may expose multiple accessible links named `OpenTodos` on the
home screen. Evaluator controls deliberately use the official BrowserGym
`nav` action `goto(<local-server>/todo)` instead of requiring a unique home
link. Input and submit remain real BrowserGym `fill(bid, text)` and
`click(bid)` actions resolved from the fresh public AXTree. This navigation
is an evaluator oracle convenience **only**, never exposed to Qwen and not a
change to Baseline/CDEA. Offline regression tests model duplicate launcher
links and verify negative and positive control traces. Live acceptance must
still be confirmed on the Windows research machine.
