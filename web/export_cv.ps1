# ==============================================================================
# PowerShell CV PDF export script for the portfolio website
# Prints the CV source files web\public\cv\CV_EN.html + CV_VN.html (design: web\public\cv\cv.css) straight from disk
# with headless Chrome to "CV_Vo Anh Duy_EN.pdf" + "CV_Vo Anh Duy_VN.pdf" in the repo root. No site build is needed.
# Edit the HTML files (preview them by double-clicking, or VS Code "Go Live"), then run this script.
# - Drift check (warning only): the two files must keep the same structure and links (npm run check:cv-html).
# - RULE: each CV is exactly ONE A4 page. Both are printed to a temp folder first and their pages counted
#   (scripts\check-cv.ts, the same check as `npm run check:cv`); if either has more than one page the script fails
#   naming the language and the repo-root PDFs are left untouched. Only when both are one page are they replaced.
# ==============================================================================
param(
    [string]$OutDir
)

Push-Location $PSScriptRoot
$stageDir = $null
$outputs = @()
try {
    $profileRepo = (Resolve-Path "$PSScriptRoot\..").Path
    if (-not $OutDir) { $OutDir = $profileRepo }

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Portfolio Website - CV PDF Export Script" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    # 1. Check Node.js + npm (the browser is found by scripts\check-cv.ts: Chrome, else Edge, or CHROME_PATH)
    Write-Host "`n[1/4] Checking environment..." -ForegroundColor Yellow
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "Error: npm is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Node.js Version: $(node -v)" -ForegroundColor Green
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installing dependencies via npm install..." -ForegroundColor Blue
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: npm install failed." -ForegroundColor Red
            Exit 1
        }
    }
    if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
    $OutDir = (Resolve-Path $OutDir).Path
    Write-Host "   Output folder: $OutDir" -ForegroundColor Green

    # 2. Drift check between the two languages (warning only)
    Write-Host "`n[2/4] Comparing CV_EN.html and CV_VN.html (structure + links)..." -ForegroundColor Yellow
    npx tsx scripts/check-cv-html.ts

    # 3. Print both files to a temp folder and enforce the one-A4-page rule
    Write-Host "`n[3/4] Printing the CVs (one A4 page each)..." -ForegroundColor Yellow
    $stageDir = Join-Path ([System.IO.Path]::GetTempPath()) "export_cv_pdfs_$PID"
    New-Item -ItemType Directory -Force $stageDir | Out-Null
    npx tsx scripts/check-cv.ts --out "$stageDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: CV RULE BROKEN (or printing failed) - see above. The PDFs in $OutDir were NOT replaced." -ForegroundColor Red
        Write-Host "Open web\public\cv\CV_EN.html / CV_VN.html (the red dashed line is the page end), shorten the text, re-run." -ForegroundColor Red
        Exit 1
    }

    # 4. Replace the PDFs and refresh the local site's copy
    Write-Host "`n[4/4] Writing the PDFs..." -ForegroundColor Yellow
    $targets = @(
        @{ Staged = 'cv-en.pdf'; File = 'CV_Vo Anh Duy_EN.pdf' },
        @{ Staged = 'cv-vi.pdf'; File = 'CV_Vo Anh Duy_VN.pdf' }
    )
    foreach ($t in $targets) {
        $dest = Join-Path $OutDir $t.File
        Move-Item -LiteralPath (Join-Path $stageDir $t.Staged) -Destination $dest -Force
        $outputs += Get-Item -LiteralPath $dest
    }
    Write-Host "   Both PDFs written (one A4 page each)." -ForegroundColor Green
    # public/content holds a synced copy of the PDFs for the local site's "Download PDF": refresh it.
    $env:CONTENT_SOURCE = 'local'
    $env:PROFILE_REPO_PATH = $profileRepo
    $syncOutput = npm run sync 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   Warning: re-sync failed; run 'npm run sync' to serve the new PDFs locally:" -ForegroundColor Yellow
        Write-Host ($syncOutput | Out-String) -ForegroundColor Yellow
    } else {
        Write-Host "   Synced the new PDFs into public/content." -ForegroundColor Green
    }
} finally {
    if ($stageDir -and (Test-Path -LiteralPath $stageDir)) {
        Remove-Item -LiteralPath $stageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "CV export completed!" -ForegroundColor Green
foreach ($f in $outputs) {
    Write-Host ("   {0}  ({1:N0} KB)" -f $f.FullName, ($f.Length / 1KB)) -ForegroundColor Green
}
Write-Host "Review the PDFs, commit + push C:\voanhduy1710 (web\public\cv\* + the two PDFs), then run deploy_vercel.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
