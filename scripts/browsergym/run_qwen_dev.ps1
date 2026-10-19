$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$openapps = Join-Path $HOME 'OpenApps'
if (-not (Test-Path (Join-Path $openapps 'launch.py'))) { throw "OpenApps checkout not found" }
Push-Location $openapps
try {
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    $env:USER = $env:USERNAME
    & uv run python (Join-Path $repo 'scripts/browsergym/isolated_qwen.py') --openapps-dir $openapps
    if ($LASTEXITCODE -ne 0) { throw "Isolated Qwen development run failed (exit $LASTEXITCODE)" }
}
finally { Pop-Location }
