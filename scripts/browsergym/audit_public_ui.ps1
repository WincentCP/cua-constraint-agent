param()
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
    $env:USER = $env:USERNAME
    & uv run python (Join-Path $repo 'scripts/browsergym/audit_public_ui.py') --openapps-dir $openapps
    if ($LASTEXITCODE -ne 0) {
        throw "Public BrowserGym UI audit failed (exit $LASTEXITCODE)"
    }
}
finally { Pop-Location }
