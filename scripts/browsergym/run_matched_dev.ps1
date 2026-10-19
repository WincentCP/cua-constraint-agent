param(
    [string]$ModelLabel = 'qwen3.5-9b',
    [string]$Task = 'add_call_mom_to_my_todo',
    [ValidateSet('all_tasks','openbanking','longer_horizon')][string]$TaskGroup = 'all_tasks',
    [ValidateRange(1,30)][int]$MaxSteps = 16
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$openapps = Join-Path $HOME 'OpenApps'
if (-not (Test-Path (Join-Path $openapps 'launch.py'))) {
    throw "OpenApps checkout not found at $openapps"
}
Push-Location $openapps
try {
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:USER = $env:USERNAME
    & uv run python (Join-Path $repo 'scripts/browsergym/matched_dev.py') --openapps-dir $openapps --model-label $ModelLabel --task $Task --task-group $TaskGroup --max-steps $MaxSteps
    if ($LASTEXITCODE -ne 0) {
        throw "Matched development validation failed (exit $LASTEXITCODE)"
    }
}
finally { Pop-Location }
