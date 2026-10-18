# Read-only Ollama connectivity/model preflight; no OpenApps run or task mutation.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$openapps = Join-Path $HOME 'OpenApps'
if (-not (Test-Path (Join-Path $openapps 'pyproject.toml'))) {
    throw "OpenApps checkout missing at $openapps"
}
Push-Location $openapps
try {
    $env:PYTHONUTF8 = '1'
    & uv run python (Join-Path $repo 'scripts/browsergym/ollama_preflight.py') --model-label qwen3.5-9b
    if ($LASTEXITCODE -ne 0) { throw "Ollama preflight failed (exit $LASTEXITCODE)" }
}
finally { Pop-Location }
