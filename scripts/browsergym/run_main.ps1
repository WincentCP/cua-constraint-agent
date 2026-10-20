param(
    [switch]$DryRun,
    [switch]$CheckModels,
    [switch]$AuditTasks,
    [switch]$InitReadiness,
    [switch]$CheckReadiness,
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
foreach ($mode in @(
    $DryRun.IsPresent, $CheckModels.IsPresent, $AuditTasks.IsPresent,
    $InitReadiness.IsPresent, $CheckReadiness.IsPresent, $Run.IsPresent
)) {
    if ($mode) { $selected += 1 }
}
if ($selected -ne 1) {
    throw 'Choose exactly one: -DryRun, -CheckModels, -AuditTasks, -InitReadiness, -CheckReadiness, or -Run.'
}
if ($Run) {
    if (-not $MainId -or -not $ReadinessFile) {
        throw 'Main -Run requires an explicit -MainId and approved -ReadinessFile.'
    }
}
elseif ($MainId -or $MaxPairs -gt 0 -or $StopOnInvalid) {
    throw 'MainId, MaxPairs and StopOnInvalid may only be used with -Run.'
}
if ($ReadinessFile -and -not ($Run -or $InitReadiness -or $CheckReadiness)) {
    throw 'ReadinessFile only applies to -InitReadiness, -CheckReadiness, or -Run.'
}
if ($ModelLabel -and -not ($CheckModels -or $Run)) {
    throw 'ModelLabel applies only to -CheckModels or -Run.'
}

$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$defaultReadiness = Join-Path $repo 'output\main\readiness_v1.json'
if (-not $ReadinessFile -and ($InitReadiness -or $CheckReadiness)) {
    $ReadinessFile = $defaultReadiness
}
if (-not (Test-Path (Join-Path $OpenAppsDir 'launch.py') -PathType Leaf)) {
    throw "Pinned OpenApps checkout not found at $OpenAppsDir"
}
if (($Run -or $CheckReadiness) -and
    -not (Test-Path -LiteralPath $ReadinessFile -PathType Leaf)) {
    throw "Readiness file not found: $ReadinessFile"
}

$mainScript = Join-Path $repo 'scripts/browsergym/main.py'
$commandArgs = @($mainScript, '--openapps-dir', $OpenAppsDir)
if ($DryRun) { $commandArgs += '--dry-run' }
if ($CheckModels) { $commandArgs += '--check-models' }
if ($InitReadiness) {
    $commandArgs += @('--init-readiness', '--readiness-file', $ReadinessFile)
}
if ($CheckReadiness) {
    $commandArgs += @(
        '--check-readiness', '--readiness-file',
        (Resolve-Path -LiteralPath $ReadinessFile).Path
    )
}
if ($AuditTasks) {
    $commandArgs = @(
        (Join-Path $repo 'scripts/browsergym/main_suitability.py'),
        '--openapps-dir', $OpenAppsDir
    )
}
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
        throw "Main readiness/runner command exited $LASTEXITCODE. Inspect the printed diagnostics and preserve any existing artifacts."
    }
}
finally {
    Pop-Location
}
