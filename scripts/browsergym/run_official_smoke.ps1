$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$openapps = Join-Path $HOME 'OpenApps'
if (-not (Test-Path (Join-Path $openapps 'launch.py'))) {
    throw "OpenApps checkout missing at $openapps"
}
Push-Location $openapps
try {
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:USER = $env:USERNAME
    & uv run python (Join-Path $repo 'scripts/browsergym/smoke.py') --openapps-dir $openapps --url 'http://127.0.0.1:5001'
    if ($LASTEXITCODE -ne 0) { throw "Smoke failed (exit $LASTEXITCODE)" }
}
finally { Pop-Location }
