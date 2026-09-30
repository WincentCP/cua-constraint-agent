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
$ProtocolPath = Join-Path $PSScriptRoot "protocol.json"
$OriginalConfig = [IO.File]::ReadAllText($ConfigPath)
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$MinimumOllamaVersion = [version]"0.13.3"
$MinimumNodeMajor = 24

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

function Get-NodeMajor {
  $raw = ((& node -v 2>&1) | Out-String).Trim()
  $match = [regex]::Match($raw, '^v?(\d+)')
  if (-not $match.Success) {
    throw "Could not parse Node.js version from: $raw"
  }
  return [int]$match.Groups[1].Value
}

function Assert-NodeVersion {
  $major = Get-NodeMajor
  if ($major -lt $MinimumNodeMajor) {
    throw "Node.js major version $major is too old. This repository requires Node.js $MinimumNodeMajor or newer."
  }
  Write-Host "==> Node.js major version $major (minimum $MinimumNodeMajor)" -ForegroundColor Cyan
}

function Get-OllamaVersion {
  $raw = ((& ollama --version 2>&1) | Out-String).Trim()
  $match = [regex]::Match($raw, '\d+\.\d+\.\d+')
  if (-not $match.Success) {
    throw "Could not parse Ollama version from: $raw"
  }
  return [version]$match.Value
}

function Assert-OllamaVersion {
  $installed = Get-OllamaVersion
  if ($installed -lt $MinimumOllamaVersion) {
    throw "Ollama $installed is too old. This benchmark requires Ollama $MinimumOllamaVersion or newer because RNJ-1 requires 0.13.3+."
  }
  Write-Host "==> Ollama version $installed (minimum $MinimumOllamaVersion)" -ForegroundColor Cyan
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
    $lines.Add("ram_free_gib=$([Math]::Round($os.FreePhysicalMemory / 1MB, 1))")
    $lines.Add("cpu=$($cpu.Name)")
    foreach ($gpu in $gpus) { $lines.Add("gpu=$($gpu.Name)") }
    try {
      $nvidia = & nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader 2>&1
      if ($LASTEXITCODE -eq 0) {
        foreach ($line in $nvidia) { $lines.Add("nvidia_smi=$line") }
      } else {
        $lines.Add("nvidia_smi_warning=$($nvidia -join ' ')")
      }
    } catch {
      $lines.Add("nvidia_smi_warning=$($_.Exception.Message)")
    }
  } catch {
    $lines.Add("hardware_capture_warning=$($_.Exception.Message)")
  }
  $lines.Add("")
  $lines.Add("ollama_list:")
  $lines.Add(($(& ollama list 2>&1) -join [Environment]::NewLine))
  [IO.File]::WriteAllLines($Destination, $lines, $Utf8NoBom)
}

Set-Location $RepoRoot
Assert-NodeVersion
Assert-OllamaVersion

if ((Test-Path $Out) -and -not $Resume) {
  throw "Output already exists: $Out. Use -Resume to continue without overwriting completed runs, or choose a new -Out path."
}

$researchStatus = & git status --porcelain -- src scripts tests config package.json package-lock.json tsconfig.json docs/PRD-FINAL.md docs/EXPERIMENT.md docs/LLM-BENCHMARK.md
if ($researchStatus) {
  throw ("Research files are not clean. Commit/stash changes before benchmarking. " + ($researchStatus -join "; "))
}

$models = @(Get-Content -Raw $ModelsPath | ConvertFrom-Json)
if ($models.Count -ne 4) {
  throw "Benchmark protocol expects exactly four primary candidates; found $($models.Count). Commit an intentional protocol change before collection."
}
$nonQ4 = @($models | Where-Object { $_.name -notmatch 'q4_K_M$' })
if ($nonQ4.Count) {
  throw "All primary candidates must use Q4_K_M tags. Invalid: $($nonQ4.name -join ', ')"
}

$protocol = Get-Content -Raw $ProtocolPath | ConvertFrom-Json
$phase = if ($Mode -eq "pilot") { $protocol.pilot } else { $protocol.full }
$tasks = @($phase.tasks)
$repetitions = [int]$phase.repetitions

$expectedTaskCount = if ($Mode -eq "pilot") { 3 } else { 6 }
$expectedRepetitions = if ($Mode -eq "pilot") { 1 } else { 3 }
if ($tasks.Count -ne $expectedTaskCount -or $repetitions -ne $expectedRepetitions) {
  throw "$Mode benchmark protocol mismatch: expected $expectedTaskCount tasks x $expectedRepetitions repetitions."
}
if (($tasks | Select-Object -Unique).Count -ne $tasks.Count) {
  throw "$Mode benchmark protocol contains duplicate task IDs."
}
$invalidTasks = @($tasks | Where-Object { $_ -notmatch '^development-\d{2}
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
  Write-Host "==> Resuming existing benchmark output: $Out" -ForegroundColor Cyan
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
    Invoke-Checked "Preflight installed model $($model.name)" { ollama show $model.name | Out-Null }
  }

  foreach ($model in $models) {
    Write-Host ""
    Write-Host "===== MODEL: $($model.name) =====" -ForegroundColor Yellow
    Set-ConfiguredModel $model.name

    $modelRoot = Join-Path $Out $model.label
    New-Item -ItemType Directory -Path $modelRoot -Force | Out-Null

    (& ollama show $model.name 2>&1) | Set-Content -Encoding utf8 (Join-Path $modelRoot "ollama-show.txt")

    $doctorOutput = & node --import tsx scripts/experiment.ts doctor 2>&1
    if ($LASTEXITCODE -ne 0) {
      $doctorOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "doctor-error.txt")
      throw "Doctor failed for $($model.name)"
    }
    $doctorOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "doctor.json")

    Warm-Model $model.name (Join-Path $modelRoot "warmup.json")
    (& ollama ps 2>&1) | Set-Content -Encoding utf8 (Join-Path $modelRoot "ollama-ps-after-warmup.txt")

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

Write-Host ""
Write-Host "Benchmark complete: $Out" -ForegroundColor Cyan
Write-Host "Share summary.csv, runs.csv, summary.json, environment.txt, and the full output directory/archive for audit."
 })
if ($invalidTasks.Count) {
  throw "$Mode benchmark protocol contains invalid task IDs: $($invalidTasks -join ', ')"
}

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
  Write-Host "==> Resuming existing benchmark output: $Out" -ForegroundColor Cyan
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
    Invoke-Checked "Preflight installed model $($model.name)" { ollama show $model.name | Out-Null }
  }

  foreach ($model in $models) {
    Write-Host ""
    Write-Host "===== MODEL: $($model.name) =====" -ForegroundColor Yellow
    Set-ConfiguredModel $model.name

    $modelRoot = Join-Path $Out $model.label
    New-Item -ItemType Directory -Path $modelRoot -Force | Out-Null

    (& ollama show $model.name 2>&1) | Set-Content -Encoding utf8 (Join-Path $modelRoot "ollama-show.txt")

    $doctorOutput = & node --import tsx scripts/experiment.ts doctor 2>&1
    if ($LASTEXITCODE -ne 0) {
      $doctorOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "doctor-error.txt")
      throw "Doctor failed for $($model.name)"
    }
    $doctorOutput | Set-Content -Encoding utf8 (Join-Path $modelRoot "doctor.json")

    Warm-Model $model.name (Join-Path $modelRoot "warmup.json")
    (& ollama ps 2>&1) | Set-Content -Encoding utf8 (Join-Path $modelRoot "ollama-ps-after-warmup.txt")

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

Write-Host ""
Write-Host "Benchmark complete: $Out" -ForegroundColor Cyan
Write-Host "Share summary.csv, runs.csv, summary.json, environment.txt, and the full output directory/archive for audit."
