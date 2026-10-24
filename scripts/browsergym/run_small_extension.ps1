param(
    [switch]$DryRun,
    [switch]$CheckModels,
    [switch]$Run,
    [string]$ExtensionId = '',
    [string]$ModelLabel = '',
    [ValidateRange(1,128)][int]$MaxPairs = 128,
    [switch]$StopOnInvalid,
    [string]$OpenAppsDir = (Join-Path $HOME 'OpenApps')
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$count = @($DryRun.IsPresent,$CheckModels.IsPresent,$Run.IsPresent) | Where-Object { $_ }
if ($count.Count -ne 1) { throw 'Choose exactly one: -DryRun, -CheckModels or -Run.' }
if ($Run -and -not $ExtensionId) { throw '-Run requires a fresh -ExtensionId.' }
if (-not $Run -and ($ExtensionId -or $StopOnInvalid)) { throw 'Execution flags require -Run.' }
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$target = Join-Path $repo 'scripts/browsergym/small_extension.py'
$argsToPass = @($target, '--openapps-dir', $OpenAppsDir)
if ($DryRun) { $argsToPass += '--dry-run' }
if ($CheckModels) { $argsToPass += '--check-models' }
if ($Run) { $argsToPass += @('--run','--extension-id',$ExtensionId,'--max-pairs',"$MaxPairs") }
if ($ModelLabel) { $argsToPass += @('--model-label',$ModelLabel) }
if ($StopOnInvalid) { $argsToPass += '--stop-on-invalid' }
if (-not $DryRun -and -not (Test-Path (Join-Path $OpenAppsDir 'launch.py') -PathType Leaf)) {
    throw "OpenApps checkout not found: $OpenAppsDir"
}
if ($DryRun) {
    & python @argsToPass
} else {
    Push-Location $OpenAppsDir
    try {
        $env:PYTHONUTF8 = '1'
        $env:PYTHONIOENCODING = 'utf-8'
        if (-not $env:USER) { $env:USER = $env:USERNAME }
        & uv run python @argsToPass
    } finally { Pop-Location }
}
if ($LASTEXITCODE -ne 0) { throw "Small extension command exited $LASTEXITCODE" }
