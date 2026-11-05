# ==============================================================================
# PowerShell CV PDF export script for the portfolio website
# Prints /en/cv and /vi/cv from a local production server to the two CV PDFs.
# The CV text comes from web\public\cv\cv.en.yaml + cv.vi.yaml (edit those, then run this script);
# the build checks both files (and that they match) and stops naming the file, field and line of any problem.
# ==============================================================================
param(
    [string]$OutDir
)

Push-Location $PSScriptRoot
$job = $null
$started = $false
$browserProc = $null
$profileDir = $null
$port = 3011
$browserTimeoutMs = 60000
try {
    $profileRepo = (Resolve-Path "$PSScriptRoot\..").Path
    if (-not $OutDir) { $OutDir = $profileRepo }

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Portfolio Website - CV PDF Export Script" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    # 1. Check Node.js, npm and a Chromium browser
    Write-Host "`n[1/5] Checking environment, Node.js & browser..." -ForegroundColor Yellow
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "Error: npm is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Node.js Version: $(node -v)" -ForegroundColor Green

    $browserCandidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    $browser = $browserCandidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if (-not $browser) {
        Write-Host "Error: neither Google Chrome nor Microsoft Edge was found." -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Browser: $browser" -ForegroundColor Green

    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
    $OutDir = (Resolve-Path $OutDir).Path
    Write-Host "   Output folder: $OutDir" -ForegroundColor Green

    # 2. Production build with content from the local profile repo
    Write-Host "`n[2/5] Building the site (npm run build, content from $profileRepo, CV from web\public\cv\cv.en.yaml + cv.vi.yaml)..." -ForegroundColor Yellow
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installing dependencies via npm install..." -ForegroundColor Blue
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: npm install failed." -ForegroundColor Red
            Exit 1
        }
    }
    $env:CONTENT_SOURCE = 'local'
    $env:PROFILE_REPO_PATH = $profileRepo
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Fix the errors before exporting (CV problems name public/cv/cv.*.yaml, the field and the line):" -ForegroundColor Red
        Write-Host ($buildOutput | Out-String) -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Build successful." -ForegroundColor Green

    # 3. Start the production server in the background and wait for it
    Write-Host "`n[3/5] Starting the server on port $port..." -ForegroundColor Yellow
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        Write-Host "Error: port $port is already in use (PID $($listening[0].OwningProcess))." -ForegroundColor Red
        Exit 1
    }
    $job = Start-Job -ScriptBlock {
        param($dir, $p)
        Set-Location $dir
        npx next start -p $p
    } -ArgumentList $PSScriptRoot, $port
    # From here on, whatever listens on the port is this script's server, so the cleanup may stop it.
    $started = $true

    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:$port/en/cv" -UseBasicParsing -TimeoutSec 3
            if ($resp.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        if ($job.State -ne 'Running') { break }
    }
    if (-not $ready) {
        Write-Host "Error: the server did not answer 200 on /en/cv within 30 seconds." -ForegroundColor Red
        Write-Host ((Receive-Job $job -ErrorAction SilentlyContinue 2>&1 | Out-String)) -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Server is up: http://localhost:$port/en/cv" -ForegroundColor Green

    # 4. Print each language to PDF with headless Chromium
    Write-Host "`n[4/5] Exporting PDFs..." -ForegroundColor Yellow
    $runStart = Get-Date
    $profileDir = Join-Path ([System.IO.Path]::GetTempPath()) "export_cv_browser_profile_$PID"
    $targets = @(
        @{ Lang = 'en'; File = 'CV_Vo Anh Duy_EN.pdf' },
        @{ Lang = 'vi'; File = 'CV_Vo Anh Duy_VN.pdf' }
    )
    $outputs = @()
    foreach ($t in $targets) {
        $pdfPath = Join-Path $OutDir $t.File
        $url = "http://localhost:$port/$($t.Lang)/cv"
        Write-Host "   $url -> $($t.File)" -ForegroundColor Blue
        $browserArgs = "--headless=new --disable-gpu --no-pdf-header-footer --user-data-dir=`"$profileDir`" --print-to-pdf=`"$pdfPath`" $url"
        $browserProc = Start-Process -FilePath $browser -ArgumentList $browserArgs -NoNewWindow -PassThru
        if (-not $browserProc.WaitForExit($browserTimeoutMs)) {
            taskkill /PID $browserProc.Id /T /F 2>&1 | Out-Null
            Write-Host "Error: the browser did not finish $($t.File) within $($browserTimeoutMs / 1000) seconds (killed)." -ForegroundColor Red
            Exit 1
        }
        $browserProc = $null
        if (-not (Test-Path -LiteralPath $pdfPath) -or (Get-Item -LiteralPath $pdfPath).LastWriteTime -lt $runStart) {
            Write-Host "Error: the browser did not write a fresh $($t.File)." -ForegroundColor Red
            Exit 1
        }
        $outputs += Get-Item -LiteralPath $pdfPath
    }
    Write-Host "   Both PDFs written." -ForegroundColor Green
    # The build's sync copied the PDFs before they were re-exported: sync again so the local site's
    # "Download PDF" serves the new files (CONTENT_SOURCE=local is still set from step 2).
    $syncOutput = npm run sync 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Warning: re-sync failed; run 'npm run sync' to serve the new PDFs locally:" -ForegroundColor Yellow
        Write-Host ($syncOutput | Out-String) -ForegroundColor Yellow
    } else {
        Write-Host "   Synced the new PDFs into public/content." -ForegroundColor Green
    }
} finally {
    # 5. Always stop the server, even on error or Ctrl+C
    Write-Host "`n[5/5] Cleaning up..." -ForegroundColor Yellow
    if ($browserProc -and -not $browserProc.HasExited) {
        taskkill /PID $browserProc.Id /T /F 2>&1 | Out-Null
        Write-Host "   Headless browser stopped." -ForegroundColor Green
    }
    if ($job) {
        Stop-Job $job -ErrorAction SilentlyContinue
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    }
    # Only a server this script started is swept; a foreign listener (the port-in-use exit above) is left alone.
    if ($started) {
        $leftover = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        foreach ($c in $leftover) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Write-Host "   Server stopped; port $port released." -ForegroundColor Green
    }
    if ($profileDir -and (Test-Path -LiteralPath $profileDir)) {
        Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "CV export completed!" -ForegroundColor Green
foreach ($f in $outputs) {
    Write-Host ("   {0}  ({1:N0} KB)" -f $f.FullName, ($f.Length / 1KB)) -ForegroundColor Green
}
Write-Host "Review the PDFs, commit + push C:\voanhduy1710 (web\public\cv\*.yaml + the two PDFs), then run deploy_vercel.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
