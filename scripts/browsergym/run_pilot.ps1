param(
    [switch]$DryRun,
    [switch]$CheckModels,
    [switch]$Run,
    [string]$PilotId = '',
    [ValidateSet('qwen3.5-9b','ministral3-8b','granite4.1-8b','xlam2-8b')]
    [string]$ModelLabel = $null,
    [ValidateRange(0,24)]
    [int]$MaxPairs = 0,
    [switch]$StopOnInvalid
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$selected = 0
foreach ($mode in @($DryRun.IsPresent, $CheckModels.IsPresent, $Run.IsPresent)) {
    if ($mode) { $selected += 1 }
}
if ($selected -ne 1) {
    throw "Choose exactly one switch: -DryRun, -CheckModels, or -Run."
}
if ($Run -and -not $PilotId) {
    throw "Actual pilot execution requires -Run -PilotId pilot_v1."
}
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$openapps = Join-Path $HOME 'OpenApps'
if (-not (Test-Path (Join-Path $openapps 'launch.py'))) {
    throw "Pinned OpenApps checkout not found at $openapps"
}

$argsToPass = @(
    (Join-Path $repo 'scripts/browsergym/pilot.py'),
    '--openapps-dir', $openapps
)
if ($DryRun) { $argsToPass += '--dry-run' }
if ($CheckModels) { $argsToPass += '--check-models' }
if ($Run) { $argsToPass += @('--run', '--pilot-id', $PilotId) }
if ($ModelLabel) { $argsToPass += @('--model-label', $ModelLabel) }
if ($MaxPairs -gt 0) {
    if (-not $Run) { throw "-MaxPairs is only accepted with -Run." }
    $argsToPass += @('--max-pairs', [string]$MaxPairs)
}
if ($StopOnInvalid) {
    if (-not $Run) { throw "-StopOnInvalid is only accepted with -Run." }
    $argsToPass += '--stop-on-invalid'
}

Push-Location $openapps
try {
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:USER = $env:USERNAME
    & uv run python @argsToPass
    if ($LASTEXITCODE -ne 0) {
        throw "Pilot command failed (exit $LASTEXITCODE). Inspect the output; existing episodes are preserved."
    }
}
finally {
    Pop-Location
}
