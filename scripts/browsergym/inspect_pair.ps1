param(
    [string]$PairPath = ''
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
    if ($PairPath) {
        & uv run python (Join-Path $repo 'scripts/browsergym/inspect_pair.py') --pair $PairPath
    }
    else {
        & uv run python (Join-Path $repo 'scripts/browsergym/inspect_pair.py') --latest
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Read-only paired artifact diagnosis failed (exit $LASTEXITCODE)"
    }
}
finally { Pop-Location }
