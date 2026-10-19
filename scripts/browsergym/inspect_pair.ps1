param(
    [string]$PairPath = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
# Resolve the user-supplied path BEFORE switching to OpenApps. A relative
# path always means relative to this thesis repository, not to OpenApps.
$resolvedPairPath = ''
if ($PairPath) {
    if ([System.IO.Path]::IsPathRooted($PairPath)) {
        $resolvedPairPath = [System.IO.Path]::GetFullPath($PairPath)
    }
    else {
        $resolvedPairPath = [System.IO.Path]::GetFullPath((Join-Path $repo $PairPath))
    }
    if (-not (Test-Path -LiteralPath $resolvedPairPath)) {
        throw "Matched development report path does not exist: $resolvedPairPath"
    }
}
$openapps = Join-Path $HOME 'OpenApps'
if (-not (Test-Path (Join-Path $openapps 'launch.py'))) {
    throw "OpenApps checkout not found at $openapps"
}
Push-Location $openapps
try {
    $env:PYTHONUTF8 = '1'
    $env:PYTHONIOENCODING = 'utf-8'
    if ($resolvedPairPath) {
        & uv run python (Join-Path $repo 'scripts/browsergym/inspect_pair.py') --pair $resolvedPairPath
    }
    else {
        & uv run python (Join-Path $repo 'scripts/browsergym/inspect_pair.py') --latest
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Read-only paired artifact diagnosis failed (exit $LASTEXITCODE)"
    }
}
finally { Pop-Location }
