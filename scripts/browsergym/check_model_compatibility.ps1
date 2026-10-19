param(
    [string]$ModelLabel = 'qwen3.5-9b'
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
    & uv run python (Join-Path $repo 'scripts/browsergym/model_compatibility.py') --model-label $ModelLabel
    if ($LASTEXITCODE -ne 0) {
        throw "Ollama action-contract preflight failed (exit $LASTEXITCODE)"
    }
}
finally { Pop-Location }
