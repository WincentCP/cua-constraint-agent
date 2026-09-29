param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("pilot", "full")]
  [string]$Mode,
  [string]$Out = "",
  [switch]$Resume
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ConfigPath = Join-Path $RepoRoot "config\experiment.json"
$ModelsPath = Join-Path $PSScriptRoot "models.json"
$OriginalConfig = [IO.File]::ReadAllText($ConfigPath)
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

if (-not $Out) {
  $Out = Join-Path $RepoRoot "exports\llm-benchmark-$Mode-v1"
} elseif (-not [IO.Path]::IsPathRooted($Out)) {
  $Out = Join-Path $RepoRoot $Out
}
$Out = [IO.Path]::GetFullPath($Out)

function Invoke-Checked {
  param([string]$Description, [scriptblock]$Command)
  Write-Host "==> $Description" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

function Set-ConfiguredModel {
  param([string]$Name)
  $cfg = Get-Content -Raw $ConfigPath | ConvertFrom-Json
  $cfg.model.name = $Name
  $json = $cfg | ConvertTo-Json -Depth 20
  [IO.File]::WriteAllText($ConfigPath, $json + [Environment]::NewLine, $Utf8NoBom)
}

function Warm-Model {
  param(
    [string]$Name,
    [string]$Destination
  )

  Write-Host "==> Warm-up $Name" -ForegroundColor Cyan
  $body = @{
    model = $Name
    prompt = "Return exactly OK."
    stream = $false
    think = $false
    keep_alive = "5m"
    options = @{
      temperature = 0
      seed = 42
      num_ctx = 8192
      num_predict = 8
    }
  } | ConvertTo-Json -Depth 10

  $started = [DateTime]::UtcNow
  try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/generate" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 300
    [PSCustomObject]@{
      model = $Name
      started_utc = $started.ToString("o")
      ended_utc = [DateTime]::UtcNow.ToString("o")
      response = $response
    } | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $Destination
  } catch {
    [PSCustomObject]@{
      model = $Name
      started_utc = $started.ToString("o")
      ended_utc = [DateTime]::UtcNow.ToString("o")
      error = $_.Exception.Message
    } | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 $Destination
    Write-Warning "Warm-up failed for $Name. The failure is preserved in $Destination; benchmark episodes will still be attempted."
  }
}

function Capture-Environment {
  param([string]$Destination)
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("captured_utc=$([DateTime]::UtcNow.ToString('o'))")
  $lines.Add("git_commit=$(& git -C $RepoRoot rev-parse HEAD)")
  $lines.Add("node=$(& node -v)")
  $lines.Add("npm=$(& npm -v)")
  $lines.Add("ollama=$(& ollama --version 2>&1)")
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $gpus = Get-CimInstance Win32_VideoController
    $lines.Add("os=$($os.Caption) $($os.Version)")
    $lines.Add("ram_gib=$([Math]::Round($os.TotalVisibleMemorySize / 1MB, 1))")
    $lines.Add("cpu=$($cpu.Name)")
    foreach ($gpu in $gpus) { $lines.Add("gpu=$($gpu.Name)") }
  } catch {
    $lines.Add("hardware_capture_warning=$($_.Exception.Message)")
  }
  try {
    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
      $gpuRows = & nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader,nounits 2>&1
      foreach ($row in $gpuRows) { $lines.Add("nvidia_gpu=$row") }
    }
  } catch {
    $lines.Add("nvidia_capture_warning=$($_.Exception.Message)")
  }
  try {
    $tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -Method Get -TimeoutSec 10
    foreach ($m in ($tags.models | Sort-Object name)) {
      $lines.Add("ollama_model=$($m.name)|$($m.digest)")
    }
  } catch {
    $lines.Add("ollama_tags_warning=$($_.Exception.Message)")
  }
  [IO.File]::WriteAllLines($Destination, $lines, $Utf8NoBom)
}

function Stable-EnvironmentText {
  param([string]$Path)
  return ((Get-Content $Path | Where-Object { $_ -notmatch "^captured_utc=" }) -join [Environment]::NewLine)
}

Set-Location $RepoRoot

$ollamaVersionText = ((& ollama --version 2>&1) | Out-String).Trim()
if ($ollamaVersionText -notmatch "(\d+\.\d+\.\d+)") {
  throw "Unable to parse Ollama version: $ollamaVersionText"
}
if ([version]$Matches[1] -lt [version]"0.13.3") {
  throw "Ollama 0.13.3 or newer is required; found $($Matches[1])."
}

if ((Test-Path $Out) -and -not $Resume) {
  throw "Output already exists: $Out. Use -Resume to continue without overwriting completed runs, or choose a new -Out path."
}

$researchStatus = & git status --porcelain -- src scripts tests config package.json package-lock.json tsconfig.json docs/PRD-FINAL.md docs/EXPERIMENT.md docs/LLM-BENCHMARK.md
if ($researchStatus) {
  throw ("Research files are not clean. Commit/stash changes before benchmarking. " + ($researchStatus -join "; "))
}

$models = @(Get-Content -Raw $ModelsPath | ConvertFrom-Json)
if ($models.Count -ne 4) {
  throw "Expected exactly 4 locked benchmark candidates; found $($models.Count)."
}
if (($models.name | Select-Object -Unique).Count -ne $models.Count) {
  throw "Benchmark model names must be unique."
}
$tasks =
  if ($Mode -eq "pilot") {
    @("development-01", "development-02", "development-03")
  } else {
    1..12 | ForEach-Object { "development-{0:D2}" -f $_ }
  }

$repetitions = if ($Mode -eq "pilot") { 1 } else { 3 }

$plan = @()
foreach ($model in $models) {
  foreach ($task in $tasks) {
    foreach ($repeat in 1..$repetitions) {
      $plan += [PSCustomObject]@{
        model = $model.name
        model_label = $model.label
        task = $task
        repetition = $repeat
        policy = "Baseline"
      }
    }
  }
}

if (-not (Test-Path $Out)) {
  New-Item -ItemType Directory -Path $Out -Force | Out-Null
}
if (-not $Resume) {
  $plan | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 (Join-Path $Out "benchmark-plan.json")
  Capture-Environment (Join-Path $Out "environment.txt")
} else {
  $originalEnvironment = Join-Path $Out "environment.txt"
  if (-not (Test-Path $originalEnvironment)) {
    throw "Cannot resume: original environment.txt is missing."
  }
  $resumeEnvironment = Join-Path $Out "environment-resume-check.txt"
  Capture-Environment $resumeEnvironment
  if ((Stable-EnvironmentText $originalEnvironment) -ne (Stable-EnvironmentText $resumeEnvironment)) {
    throw "Cannot resume: stable machine/runtime/model environment differs from the original benchmark. Preserve this output and start a fresh -Out directory."
  }
  Remove-Item $resumeEnvironment -Force
  Write-Host "==> Resuming existing benchmark output with matching environment: $Out" -ForegroundColor Cyan
}

try {
  Invoke-Checked "npm ci" { npm ci }
  Invoke-Checked "Playwright Chromium install" { npx playwright install chromium }
  Invoke-Checked "TypeScript build" { npm run build }
  Invoke-Checked "Unit tests" { npm test }
  Invoke-Checked "Integration tests" { npm run test:integration }
  Invoke-Checked "Formatting check" { npm run format:check }
  Invoke-Checked "Dataset validation" { npm run experiment -- validate }

  foreach ($model in $models) {
    Write-Host ""
    Write-Host "===== MODEL: $($model.name) =====" -ForegroundColor Yellow
    $modelRoot = Join-Path $Out $model.label
    New-Item -ItemType Directory -Path $modelRoot -Force | Out-Null
    $showOutput = & ollama show $model.name 2>&1
    if ($LASTEXITCODE -ne 0) {
      $showOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "ollama-show-error.txt")
      throw "Check installed model $($model.name) failed."
    }
    $showOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "ollama-show.txt")
    $showText = ($showOutput -join [Environment]::NewLine)
    if ($showText -notmatch "(?im)^\s*quantization\s+Q4_K_M\s*$") {
      throw "Model $($model.name) is not Q4_K_M according to ollama show. See $modelRoot\ollama-show.txt."
    }
    Set-ConfiguredModel $model.name

    $doctorOutput = & node --import tsx scripts/experiment.ts doctor 2>&1
    if ($LASTEXITCODE -ne 0) {
      $doctorOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "doctor-error.txt")
      throw "Doctor failed for $($model.name)"
    }
    $doctorOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "doctor.json")

    Warm-Model $model.name (Join-Path $modelRoot "warmup.json")

    foreach ($task in $tasks) {
      foreach ($repeat in 1..$repetitions) {
        $runOut = Join-Path $modelRoot (Join-Path $task ("r" + $repeat))
        $episodesPath = Join-Path $runOut "episodes.jsonl"
        if ($Resume -and (Test-Path $episodesPath)) {
          Write-Host "-- SKIP existing $($model.label) / $task / repetition $repeat" -ForegroundColor DarkGray
          continue
        }
        if ($Resume -and (Test-Path $runOut)) {
          $stamp = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ")
          $interrupted = "$runOut-interrupted-$stamp"
          Move-Item -Path $runOut -Destination $interrupted
          Write-Warning "Preserved incomplete external interruption at $interrupted; rerunning this cell cleanly."
        }
        Write-Host "-- $($model.label) / $task / repetition $repeat" -ForegroundColor Green
        & node --import tsx scripts/experiment.ts episode --task $task --policy Baseline --repeat $repeat --out $runOut
        if ($LASTEXITCODE -ne 0) {
          Write-Warning "Recorded failure at $($model.name) / $task / repetition $repeat. Preserving the attempt and continuing so deployment reliability remains part of the benchmark."
        }
      }
    }

    Write-Host "==> Unload $($model.name)" -ForegroundColor Cyan
    $previousErrorActionPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = "Continue"
      & ollama stop $model.name *> $null
    } finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
  }
}
finally {
  [IO.File]::WriteAllText($ConfigPath, $OriginalConfig, $Utf8NoBom)
}

Invoke-Checked "Benchmark analysis" {
  node --import tsx scripts/benchmark/analyze.ts --root $Out
}

if ($Mode -eq "pilot") {
  $summary = Get-Content -Raw (Join-Path $Out "summary.json") | ConvertFrom-Json
  $bad = @($summary.models | Where-Object {
    $_.runs -ne 3 -or $_.healthy_runs -ne 3 -or $_.infrastructure_failures -ne 0
  })
  if ($bad.Count -gt 0) {
    throw "Pilot preflight failed: require 12/12 healthy episodes (3/3 per model, zero infrastructure failures). Inspect summary.csv and per-model diagnostics before full benchmark."
  }
}

Write-Host ""
Write-Host "Benchmark complete: $Out" -ForegroundColor Cyan
Write-Host "Share summary.csv, runs.csv, summary.json, environment.txt, and the full output directory/archive for audit."
