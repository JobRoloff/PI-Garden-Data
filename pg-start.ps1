$ErrorActionPreference = "Stop"

$ComposeDir = "C:\Users\jobro\PI-Garden-Data"
$LogDir = Join-Path $ComposeDir "logs"
$LogFile = Join-Path $LogDir "startup.log"
$DockerDesktopExe = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
$MaxAttempts = 90
$SleepSeconds = 5

if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

if (Test-Path $LogFile) {
    Clear-Content -Path $LogFile -ErrorAction SilentlyContinue
}

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $LogFile -Value "$timestamp - $Message"
}

Write-Log "Script execution started."
Write-Log "SCRIPT VERSION: 2026-03-29-C"
Write-Log "Script path: $PSCommandPath"
Write-Log "Compose directory: $ComposeDir"

if (!(Test-Path $ComposeDir)) {
    Write-Log "ERROR: Compose directory does not exist."
    exit 1
}

if (Test-Path $DockerDesktopExe) {
    $dockerDesktopRunning = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
    if (-not $dockerDesktopRunning) {
        Write-Log "Docker Desktop is not running. Starting it."
        Start-Process -FilePath $DockerDesktopExe
        Start-Sleep -Seconds 10
    } else {
        Write-Log "Docker Desktop process already running."
    }
} else {
    Write-Log "WARNING: Docker Desktop executable not found at $DockerDesktopExe"
}

Set-Location $ComposeDir

$dockerReady = $false

for ($i = 1; $i -le $MaxAttempts; $i++) {
    $null = cmd /c "docker info" 2>$null
    if ($LASTEXITCODE -eq 0) {
        $dockerReady = $true
        Write-Log "Docker is ready on attempt $i."
        break
    }

    Write-Log "Docker not ready yet. Attempt $i of $MaxAttempts."
    Start-Sleep -Seconds $SleepSeconds
}

if (-not $dockerReady) {
    Write-Log "ERROR: Docker did not become ready after $MaxAttempts attempts."
    exit 1
}

Write-Log "Running: docker compose up -d"
$composeOutput = cmd /c "docker compose up -d" 2>&1
$composeExit = $LASTEXITCODE
$composeOutput | ForEach-Object { Write-Log "$_" }

if ($composeExit -ne 0) {
    Write-Log "ERROR: docker compose up failed with exit code $composeExit."
    exit 1
}

Write-Log "docker compose up completed successfully."

Write-Log "Running: docker ps"
$psOutput = cmd /c "docker ps" 2>&1
$psExit = $LASTEXITCODE
$psOutput | ForEach-Object { Write-Log "$_" }

if ($psExit -ne 0) {
    Write-Log "ERROR: docker ps failed with exit code $psExit."
    exit 1
}

Write-Log "Script execution completed."
exit 0