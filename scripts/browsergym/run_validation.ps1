$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$controls = Join-Path $PSScriptRoot 'run_evaluator_controls.ps1'
$qwen = Join-Path $PSScriptRoot 'run_qwen_dev.ps1'
& powershell -NoProfile -ExecutionPolicy Bypass -File $controls
if ($LASTEXITCODE -ne 0) { throw "Evaluator/isolation gate failed (exit $LASTEXITCODE): Qwen run skipped" }
Write-Host 'Evaluator/isolation gate passed. Starting isolated Qwen development run.'
& powershell -NoProfile -ExecutionPolicy Bypass -File $qwen
if ($LASTEXITCODE -ne 0) { throw "Qwen development runner failed (exit $LASTEXITCODE)" }
