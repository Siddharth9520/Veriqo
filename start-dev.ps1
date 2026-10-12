<#
.SYNOPSIS
    Veriqo Local Development Launcher
.DESCRIPTION
    Safely launches both the Python FastAPI backend and Next.js frontend
    in independent processes, validates environment connectivity, and handles shutdown.
#>

[CmdletBinding()]
param (
    [switch]$SeparateWindows
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "             VERIQO — LOCAL DEVELOPMENT LAUNCHER          " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Environment & Prerequisite Checks
Write-Host "[1/4] Verifying prerequisites..." -ForegroundColor Yellow

$backendDir = Join-Path $ScriptDir "backend"
$frontendDir = Join-Path $ScriptDir "frontend"
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $backendDir)) {
    Write-Error "Backend directory not found at $backendDir"
}
if (-not (Test-Path $frontendDir)) {
    Write-Error "Frontend directory not found at $frontendDir"
}
if (-not (Test-Path $venvPython)) {
    Write-Warning "Backend virtual environment (.venv) not found."
    Write-Host "Please set up the backend virtual environment first:"
    Write-Host "  cd backend"
    Write-Host "  python -m venv .venv"
    Write-Host "  .\.venv\Scripts\pip install -r requirements.txt"
    Write-Host "  .\.venv\Scripts\playwright install chromium chromium-headless-shell"
    exit 1
}

$nodeModules = Join-Path $frontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Warning "Frontend dependencies (node_modules) not found."
    Write-Host "Please install frontend dependencies first:"
    Write-Host "  cd frontend"
    Write-Host "  npm install"
    exit 1
}

# 2. Check Port Availability
Write-Host "[2/4] Checking ports 8000 and 3000..." -ForegroundColor Yellow
$port8000InUse = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$port3000InUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($port8000InUse) {
    Write-Warning "Port 8000 is already in use (PID: $($port8000InUse[0].OwningProcess)). Backend might already be running."
}
if ($port3000InUse) {
    Write-Warning "Port 3000 is already in use (PID: $($port3000InUse[0].OwningProcess)). Frontend might already be running."
}

# 3. Launch Services
Write-Host "[3/4] Starting services..." -ForegroundColor Yellow

if ($SeparateWindows) {
    Write-Host "Starting Backend in dedicated PowerShell window..." -ForegroundColor Green
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

    Write-Host "Starting Frontend in dedicated PowerShell window..." -ForegroundColor Green
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "cd '$frontendDir'; npm run dev"

    Write-Host "`nBoth services launched in separate windows." -ForegroundColor Cyan
    Write-Host "Backend API:      http://127.0.0.1:8000" -ForegroundColor White
    Write-Host "Interactive Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
    Write-Host "Frontend UI:      http://localhost:3000" -ForegroundColor White
    exit 0
}

# Default mode: Background jobs with consolidated log streaming and health polling
$backendJob = Start-Job -ScriptBlock {
    param($bDir, $py)
    Set-Location $bDir
    & $py -m uvicorn app.main:app --host 127.0.0.1 --port 8000
} -ArgumentList $backendDir, $venvPython

$frontendJob = Start-Job -ScriptBlock {
    param($fDir)
    Set-Location $fDir
    npm run dev
} -ArgumentList $frontendDir

Write-Host "Waiting for services to become healthy..." -ForegroundColor Yellow

# Poll Backend
$backendReady = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($res.status -eq "operational") {
            $backendReady = $true
            break
        }
    } catch {}
}

if ($backendReady) {
    Write-Host " [PASS] Backend is operational at http://127.0.0.1:8000" -ForegroundColor Green
} else {
    Write-Warning " Backend health check timed out. Checking backend logs:"
    Receive-Job -Job $backendJob | Write-Host
}

# Poll Frontend
$frontendReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -ErrorAction Stop
        if ($res.StatusCode -eq 200) {
            $frontendReady = $true
            break
        }
    } catch {}
}

if ($frontendReady) {
    Write-Host " [PASS] Frontend is ready at http://localhost:3000" -ForegroundColor Green
} else {
    Write-Warning " Frontend connection timed out. Checking frontend logs:"
    Receive-Job -Job $frontendJob | Write-Host
}

Write-Host "`n[4/4] Veriqo is running!" -ForegroundColor Cyan
Write-Host "Frontend:         http://localhost:3000" -ForegroundColor White
Write-Host "Backend API:      http://127.0.0.1:8000" -ForegroundColor White
Write-Host "API Swagger Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "`nPress Ctrl+C to terminate both services and exit.`n" -ForegroundColor DarkYellow

try {
    while ($true) {
        $bLogs = Receive-Job -Job $backendJob
        if ($bLogs) { $bLogs | ForEach-Object { Write-Host "[BACKEND] $_" -ForegroundColor DarkGray } }

        $fLogs = Receive-Job -Job $frontendJob
        if ($fLogs) { $fLogs | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor DarkCyan } }

        if ($backendJob.State -ne "Running") {
            Write-Warning "Backend job terminated unexpectedly!"
            Receive-Job -Job $backendJob | Write-Host
            break
        }
        if ($frontendJob.State -ne "Running") {
            Write-Warning "Frontend job terminated unexpectedly!"
            Receive-Job -Job $frontendJob | Write-Host
            break
        }

        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`nShutting down Veriqo services..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "All services stopped cleanly." -ForegroundColor Green
}
