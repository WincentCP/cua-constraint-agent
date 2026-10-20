param(
    [switch]$DryRun,
    [switch]$CheckModels,
    [switch]$Run,
    [string]$MainId = '',
    [string]$ReadinessFile = '',
    [ValidateSet('qwen3.5-9b','ministral3-8b','granite4.1-8b','xlam2-8b')]
    [string]$ModelLabel = '',
    [ValidateRange(0,128)]
    [int]$MaxPairs = 0,
    [switch]$StopOnInvalid,
    [string]$OpenAppsDir = (Join-Path $HOME 'OpenApps')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$selected = 0
foreach ($mode in @($DryRun.IsPresent, $CheckModels.IsPresent, $Run.IsPresent)) {
    if ($mode) { $selected += 1 }
}
if ($selected -ne 1) {
    throw 'Choose exactly one of -DryRun, -CheckModels, or -Run.'
}
if ($Run) {
    if (-not $MainId -or -not $ReadinessFile) {
        throw 'Main -Run requires an explicit -MainId and approved -ReadinessFile.'
    }
    if (-not (Test-Path -LiteralPath $ReadinessFile -PathType Leaf)) {
        throw "Readiness evidence attestation not found: $ReadinessFile"
    }
}
elseif ($MainId -or $ReadinessFile -or $MaxPairs -gt 0 -or $StopOnInvalid) {
    throw 'MainId, ReadinessFile, MaxPairs and StopOnInvalid are only for -Run.'
}
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $OpenAppsDir 'launch.py') -PathType Leaf)) {
    throw "Pinned OpenApps checkout not found at $OpenAppsDir"
}
$commandArgs = @(
    (Join-Path $repo 'scripts/browsergym/main.py'),
    '--openapps-dir', $OpenAppsDir
)
if ($DryRun) { $commandArgs += '--dry-run' }
if ($CheckModels) { $commandArgs += '--check-models' }
if ($Run) {
    $commandArgs += @(
        '--run', '--main-id', $MainId, '--readiness-file',
        (Resolve-Path -LiteralPath $ReadinessFile).Path
    )
}
if ($ModelLabel) { $commandArgs += @('--model-label', $ModelLabel) }
if ($MaxPairs -gt 0) { $commandArgs += @('--max-pairs', [string]$MaxPairs) }
if ($StopOnInvalid) { $commandArgs += '--stop-on-invalid' }

Push-Location $OpenAppsDir
try {
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    if (-not $env:USER) {
        $env:USER = $env:USERNAME
    }
    & uv run python @commandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Main command exited $LASTEXITCODE. Invalids or failed gates are not success; inspect preserved output."
    }
}
finally {
    Pop-Location
}
