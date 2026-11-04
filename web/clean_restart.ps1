param(
    [switch]$SkipDeploy
)

# clean_restart.ps1
# Dedicated clean restart script for the portfolio website (isolated strictly to port 3010)

Push-Location $PSScriptRoot
try {
    Write-Host "=== Portfolio Website Clean Restart Script (Port 3010 Isolated) ===" -ForegroundColor Cyan

    # Step 1: Clear process on port 3010 ONLY
    Write-Host "`n[1/2] Clearing process on port 3010..." -ForegroundColor Yellow
    $pids = netstat -ano | Select-String ":3010\s+\S+\s+LISTENING" | ForEach-Object {
        if ($_ -match '\s+(\d+)$') { $Matches[1] }
    } | Where-Object { $_ -ne '0' } | Select-Object -Unique

    if ($pids) {
        $pids | ForEach-Object {
            try {
                Stop-Process -Id $_ -Force -ErrorAction Stop
                Write-Host "  Killed process on port 3010 (PID: $_)" -ForegroundColor Green
            } catch {
                Write-Host "  Could not stop PID $_ : $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  Port 3010 is already free." -ForegroundColor Gray
    }

    # Step 2: Verify port 3010 is free
    Write-Host "`n[2/2] Verifying port 3010 release..." -ForegroundColor Yellow
    $deadline = (Get-Date).AddSeconds(5)
    do {
        $listener = Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue
        if (-not $listener) { break }
        Start-Sleep -Milliseconds 250
    } while ((Get-Date) -lt $deadline)

    if ($listener) {
        Write-Host "  Warning: Port 3010 is still in use." -ForegroundColor Red
    } else {
        Write-Host "  Port 3010 is confirmed free." -ForegroundColor Green
    }

    Write-Host "`n=== Cleanup Complete ===" -ForegroundColor Cyan

    if ($SkipDeploy) {
        Write-Host "Skipped deploy_local.ps1 because -SkipDeploy parameter was provided." -ForegroundColor White
        return
    }

    # Auto-start deploy_local.ps1
    Write-Host "`nStarting deploy_local.ps1..." -ForegroundColor Cyan
    & "$PSScriptRoot\deploy_local.ps1"
} finally {
    Pop-Location
}
