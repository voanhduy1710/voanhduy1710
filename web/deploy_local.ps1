# PowerShell local preview script for the portfolio website
Push-Location $PSScriptRoot
try {
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host " Portfolio Website - Local Deployment Script" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan

    # 0. A dev server already on port 3010 holds files in public/content, so a new sync could not replace them
    #    (Windows refuses the folder swap). Use that server instead of starting a second one.
    $listener = $null
    try {
        $listener = Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction Stop | Select-Object -First 1
    } catch {
        $listener = $null
    }
    if ($listener) {
        Write-Host "Dev server already running on http://localhost:3010 (PID $($listener.OwningProcess)): use it, or run clean_restart.ps1 to restart it with fresh content." -ForegroundColor Yellow
        Exit 0
    }

    # 1. Check Node.js and npm
    Write-Host "[1/3] Checking environment..." -ForegroundColor Yellow
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "Error: npm is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }

    $nodeVersion = node -v
    $npmVersion = npm -v
    Write-Host "   Node.js version: $nodeVersion" -ForegroundColor Green
    Write-Host "   npm version:     $npmVersion" -ForegroundColor Green

    # 2. Verify or install dependencies
    Write-Host "[2/3] Checking dependencies..." -ForegroundColor Yellow
    if (-not (Test-Path "node_modules")) {
        Write-Host "   node_modules folder missing. Running npm install..." -ForegroundColor Blue
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: npm install failed." -ForegroundColor Red
            Exit 1
        }
    } else {
        Write-Host "   node_modules verified." -ForegroundColor Green
    }

    # 3. Sync content from the local profile repo (npm predev) and launch Next.js on port 3010
    $env:CONTENT_SOURCE = 'local'
    $env:PROFILE_REPO_PATH = (Resolve-Path "$PSScriptRoot\..").Path
    Write-Host "[3/3] Starting Next.js Development Server on Port 3010..." -ForegroundColor Yellow
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "   Content source:  local ($env:PROFILE_REPO_PATH)" -ForegroundColor Green
    Write-Host "   Local App URL:   http://localhost:3010" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan

    npm run dev -- -p 3010
} finally {
    Pop-Location
}
