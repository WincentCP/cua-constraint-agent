param(
    [string]$ScaleId = '',
    [string]$InputPath = '',
    [switch]$RequireComplete,
    [string]$OpenAppsDir = (Join-Path $HOME 'OpenApps')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (($ScaleId -and $InputPath) -or (-not $ScaleId -and -not $InputPath)) {
    throw 'Choose exactly one input: -ScaleId or -InputPath.'
}
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if ($ScaleId) {
    if ($ScaleId -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$') {
        throw 'Invalid ScaleId.'
    }
    $source = Join-Path (Join-Path $repo 'output\scale') $ScaleId
} else {
    $source = $InputPath
}
if (-not (Test-Path -LiteralPath $source)) {
    throw "Scale directory or archive does not exist: $source"
}
if (-not (Test-Path -LiteralPath (Join-Path $OpenAppsDir 'launch.py') -PathType Leaf)) {
    throw "Pinned OpenApps checkout not found at $OpenAppsDir"
}
$source = (Resolve-Path -LiteralPath $source).Path
$target = Join-Path $repo 'scripts\browsergym\audit_scale_runtime.py'
$report = if ($ScaleId) {
    Join-Path (Join-Path (Join-Path $repo 'output\scale') $ScaleId) 'runtime_evidence_report.json'
} else {
    Join-Path $repo 'output\scale_runtime_audit.json'
}
$argsToPass = @(
    $target, $source, '--repo-root', $repo,
    '--openapps-dir', $OpenAppsDir,
    '--report', $report, '--require-runtime-contract'
)
if ($RequireComplete) { $argsToPass += '--require-complete' }
& python @argsToPass
if ($LASTEXITCODE -ne 0) {
    throw "Scale evidence audit failed ($LASTEXITCODE). See $report."
}
Write-Host "Scale runtime artifact audit passed. Report: $report"
