# ==============================================================================
# PowerShell Vercel Deployment Script for the portfolio website
# ==============================================================================
# The caller's own values are put back at the end (the token is only set while the Vercel CLI runs).
$callerHadToken = Test-Path Env:VERCEL_TOKEN
$callerToken = $env:VERCEL_TOKEN
$callerHadRef = Test-Path Env:CONTENT_REF
$callerRef = $env:CONTENT_REF
function Restore-CallerToken {
    if ($callerHadToken) { $env:VERCEL_TOKEN = $callerToken } else { Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue }
}

Push-Location $PSScriptRoot
try {
    $profileRepo = (Resolve-Path "$PSScriptRoot\..").Path

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Portfolio Website - Vercel Production Deploy Script" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    # 1. Check Node.js
    Write-Host "`n[1/5] Checking environment & Node.js..." -ForegroundColor Yellow
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Error: Node.js is not installed or not in PATH." -ForegroundColor Red
        Exit 1
    }
    $nodeVersion = node -v
    Write-Host "   Node.js Version: $nodeVersion" -ForegroundColor Green
    # The Vercel CLI is a pinned devDependency; it is run from node_modules, never fetched as "latest".
    $vercel = Join-Path $PSScriptRoot 'node_modules\.bin\vercel.cmd'
    if (-not (Test-Path "node_modules") -or -not (Test-Path $vercel)) {
        Write-Host "   Installing dependencies via npm install..." -ForegroundColor Blue
        npm install
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $vercel)) {
            Write-Host "Error: npm install failed (or did not install the Vercel CLI)." -ForegroundColor Red
            Exit 1
        }
    } else {
        Write-Host "   node_modules verified." -ForegroundColor Green
    }
    Write-Host "   Vercel CLI: $((& $vercel --version 2>$null | Select-Object -Last 1))" -ForegroundColor Green

    # 2. Vercel access token: environment, then web\.env, then profile-repo .env. Never printed.
    Write-Host "`n[2/5] Authenticating with Vercel..." -ForegroundColor Yellow
    $vercelToken = $env:VERCEL_ACCESS_TOKEN
    if (-not $vercelToken) { $vercelToken = $env:VERCEL_TOKEN }
    if (-not $vercelToken) {
        foreach ($envFile in @("$PSScriptRoot\.env", "$profileRepo\.env")) {
            if ($vercelToken -or -not (Test-Path $envFile)) { continue }
            foreach ($line in (Get-Content $envFile)) {
                if ($line.Trim() -match '^(VERCEL_ACCESS_TOKEN|VERCEL_TOKEN)\s*=\s*(.+)$') {
                    $vercelToken = $matches[2].Trim().Trim('"').Trim("'")
                    if ($vercelToken) { break }
                }
            }
        }
    }
    if (-not $vercelToken) {
        Write-Host "Error: Vercel token not found." -ForegroundColor Red
        Write-Host "   Set `$env:VERCEL_ACCESS_TOKEN, or put VERCEL_ACCESS_TOKEN=... in web\.env (see .env.example)." -ForegroundColor Yellow
        Exit 1
    }
    # The CLI reads VERCEL_TOKEN itself, so the token is never passed on a command line.
    $env:VERCEL_TOKEN = $vercelToken

    $whoamiRaw = & $vercel whoami 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: 'vercel whoami' failed. Check the token and your network connection." -ForegroundColor Red
        Exit 1
    }
    # The username is the last non-empty output line (npx/CLI notices come before it).
    $whoami = ($whoamiRaw | Where-Object { $_ -and $_.Trim() } | Select-Object -Last 1)
    if ($whoami) { $whoami = $whoami.Trim() } else { $whoami = '(unknown)' }
    Write-Host "   Authenticated Vercel User: $whoami" -ForegroundColor Green

    # Contact form + keep-alive + content-sync settings (Resend, Supabase, CRON_SECRET, GITHUB_TOKEN): copied from web\.env (or the profile-repo .env) to the project's production env, so the
    # deployed /api/contact can send email. A value is never put on a command line and never printed: it is written
    # (UTF-8, no BOM, no newline) to a temp file that becomes the CLI's stdin, and the file is deleted right after.
    # (Piping a string from PowerShell 5.1 adds a CRLF, which the CLI strips, but can also add a UTF-8 BOM, which it
    # does not, so the pipe is not used.)
    function Get-DotEnvValue([string]$name) {
        foreach ($envFile in @("$PSScriptRoot\.env", "$profileRepo\.env")) {
            if (-not (Test-Path $envFile)) { continue }
            foreach ($line in (Get-Content $envFile)) {
                if ($line.Trim() -match ('^{0}\s*=\s*(.*)$' -f [regex]::Escape($name))) {
                    $value = $matches[1].Trim().Trim('"').Trim("'")
                    if ($value) { return $value }
                }
            }
        }
        return $null
    }
    $hasResend = [bool](Get-DotEnvValue 'RESEND_API_KEY')
    $hasSupabase = [bool](Get-DotEnvValue 'SUPABASE_SECRET_KEY')
    if (-not $hasResend) {
        Write-Host "   Warning: RESEND_API_KEY is not in web\.env or the profile-repo .env: contact messages will not be emailed (unless the key is already set in the Vercel project)." -ForegroundColor Yellow
    }
    if (-not $hasSupabase) {
        Write-Host "   Warning: SUPABASE_SECRET_KEY is not in web\.env or the profile-repo .env: contact messages will not be saved (unless the key is already set in the Vercel project)." -ForegroundColor Yellow
    }
    $hasCron = [bool](Get-DotEnvValue 'CRON_SECRET')
    if (-not $hasCron) {
        Write-Host "   Note: CRON_SECRET is not in web\.env: set CRON_SECRET in Vercel to protect /api/keepalive (without it the daily Supabase keep-alive is refused)." -ForegroundColor Yellow
    }
    # Optional: lets the content sync list the Certifications repo on Vercel without the 60 requests/hour limit.
    $hasGithub = [bool](Get-DotEnvValue 'GITHUB_TOKEN')
    if (-not $hasResend -and -not $hasSupabase) {
        Write-Host "   Warning: with neither key the deployed contact form will show the email fallback." -ForegroundColor Yellow
    }
    if ($hasResend -or $hasSupabase -or $hasCron -or $hasGithub) {
        Write-Host "   Syncing contact form, keep-alive and content-sync settings to the Vercel production environment..." -ForegroundColor Blue
        foreach ($name in @('RESEND_API_KEY', 'CONTACT_TO', 'CONTACT_FROM', 'SUPABASE_SECRET_KEY', 'SUPABASE_URL', 'CRON_SECRET', 'GITHUB_TOKEN')) {
            $value = Get-DotEnvValue $name
            if (-not $value) { continue }
            $valueFile = [System.IO.Path]::GetTempFileName()
            $outFile = [System.IO.Path]::GetTempFileName()
            $errFile = [System.IO.Path]::GetTempFileName()
            $ok = $false
            $errText = ''
            try {
                [System.IO.File]::WriteAllBytes($valueFile, [System.Text.Encoding]::UTF8.GetBytes($value))
                $proc = Start-Process -FilePath $vercel -ArgumentList "env add $name production --force --sensitive --yes --project voanhduy1710" `
                    -RedirectStandardInput $valueFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile -NoNewWindow -Wait -PassThru
                $ok = $proc.ExitCode -eq 0
                if (-not $ok) {
                    # The CLI's error, with any copy of the value replaced by *** (it should never echo it, but be sure).
                    $errText = [System.IO.File]::ReadAllText($errFile)
                    if ($errText) { $errText = $errText.Replace($value, '***').Trim() }
                }
            } finally {
                $value = $null
                Remove-Item $valueFile, $outFile, $errFile -Force -ErrorAction SilentlyContinue
                if (Test-Path $valueFile) {
                    Write-Host "   Warning: could not delete the temp file holding the $name value: $valueFile (delete it by hand)." -ForegroundColor Red
                }
            }
            if (-not $ok) {
                Write-Host "Error: could not sync $name to the Vercel project." -ForegroundColor Red
                if ($errText) { Write-Host $errText -ForegroundColor Red }
                Exit 1
            }
            Write-Host "   $name synced." -ForegroundColor Green
        }
    }
    Restore-CallerToken

    # 3. Profile repo check. Production reads README/CV/assets from GitHub main, so local-only changes would be missed.
    Write-Host "`n[3/5] Checking the profile repo ($profileRepo)..." -ForegroundColor Yellow
    $problems = @()
    $dirty = git -C $profileRepo status --porcelain -- README.md READMEVN.md "CV_Vo Anh Duy_*.pdf" web/public/logos web/public/previews
    if ($dirty) {
        $files = ($dirty | ForEach-Object { $_.Trim() }) -join ', '
        $problems += "uncommitted changes in README / CV / logos / previews: $files"
    }
    # The build reads GitHub raw at the exact commit of origin/main: raw "main" is cached for ~5 minutes and could
    # serve a README from before the last push.
    $contentRef = 'main'
    git -C $profileRepo fetch --quiet origin 2>$null
    if ($LASTEXITCODE -ne 0) {
        $problems += "could not run 'git fetch' (offline?), so unpushed commits cannot be ruled out"
    } else {
        $sha = git -C $profileRepo rev-parse origin/main 2>$null
        if ($LASTEXITCODE -eq 0 -and $sha) { $contentRef = "$sha".Trim() }
        $ahead = git -C $profileRepo rev-list --count origin/main..main 2>$null
        if ($LASTEXITCODE -eq 0 -and [int]$ahead -gt 0) {
            $problems += "local main is $ahead commit(s) ahead of origin/main (not pushed)"
        }
    }
    $branch = (git -C $profileRepo rev-parse --abbrev-ref HEAD).Trim()
    if ($branch -ne 'main') {
        $problems += "current branch is '$branch', not 'main'"
    }

    if ($problems.Count -gt 0) {
        Write-Host "   Warning: production reads GitHub main; push first." -ForegroundColor Yellow
        foreach ($p in $problems) { Write-Host "   - $p" -ForegroundColor Yellow }
        $answer = Read-Host "Continue anyway? (y/N)"
        if ($answer -notmatch '^(y|yes)$') {
            Write-Host "   Aborted before building. Nothing was deployed." -ForegroundColor Red
            Exit 1
        }
    } else {
        Write-Host "   Profile repo is clean and pushed (branch main)." -ForegroundColor Green
    }

    if ($contentRef -eq 'main') {
        Write-Host "   Content: GitHub main (commit SHA unknown: raw files may be up to ~5 minutes old)." -ForegroundColor Yellow
    } else {
        Write-Host "   Content: origin/main @ $($contentRef.Substring(0, 7))" -ForegroundColor Green
    }

    # 4. Production build (the prebuild sync fetches content from GitHub at $contentRef), then the link check
    Write-Host "`n[4/5] Running production build check (npm run build + npm run check:links)..." -ForegroundColor Yellow
    $env:CONTENT_SOURCE = 'github'
    $env:CONTENT_REF = $contentRef
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Fix the errors before deploying:" -ForegroundColor Red
        Write-Host ($buildOutput | Out-String) -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Build successful." -ForegroundColor Green
    $linkOutput = npm run check:links 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Link check failed! Broken links in the built pages:" -ForegroundColor Red
        Write-Host ($linkOutput | Out-String) -ForegroundColor Red
        Exit 1
    }
    Write-Host "   Link check passed." -ForegroundColor Green

    # 5. Deploy to production (vercel runs from web/, so only this folder is uploaded)
    $shortRef = $contentRef
    if ($contentRef -ne 'main') { $shortRef = $contentRef.Substring(0, 7) }
    Write-Host "`n[5/5] Deploying content $shortRef to Production on Vercel account ($whoami)..." -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Cyan
    $env:VERCEL_TOKEN = $vercelToken
    if (-not (Test-Path ".vercel\project.json")) {
        Write-Host "   Linking to Vercel project voanhduy1710..." -ForegroundColor Blue
        & $vercel link --yes --project voanhduy1710
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: could not link the Vercel project." -ForegroundColor Red
            Exit 1
        }
    }
    # Vercel's own build re-runs the sync; --build-env pins it to the same commit as the local check build.
    & $vercel --prod --yes --build-env "CONTENT_REF=$contentRef"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Vercel deployment failed." -ForegroundColor Red
        Exit 1
    }

    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "Vercel Production Deployment Completed! (content $shortRef)" -ForegroundColor Green
    Write-Host "   https://voanhduy1710.vercel.app" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Cyan
} finally {
    Restore-CallerToken
    if ($callerHadRef) { $env:CONTENT_REF = $callerRef } else { Remove-Item Env:CONTENT_REF -ErrorAction SilentlyContinue }
    Pop-Location
}
