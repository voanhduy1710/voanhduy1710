<#
  Puts zalo-notification-fix.user.js into the Zalo tab of Orca's built-in browser.

  .\zalo-fix.ps1          inject once
  .\zalo-fix.ps1 -Watch   keep running; re-inject whenever the Zalo tab reloads (checks every 20 s)
#>
param(
  [switch]$Watch,
  [int]$IntervalSec = 20
)

$ErrorActionPreference = 'Stop'
$jsPath = Join-Path $PSScriptRoot 'zalo-notification-fix.user.js'

# Orca CLI: env var (set inside Orca terminals), PATH, or the default install location.
$orca = $env:ORCA_CLI_COMMAND
if (-not $orca) { $cmd = Get-Command orca -ErrorAction SilentlyContinue; if ($cmd) { $orca = $cmd.Source } }
if (-not $orca) { $orca = Join-Path $env:LOCALAPPDATA 'Programs\orca\resources\bin\orca.exe' }
if (-not (Test-Path $orca)) { Write-Host "Orca CLI not found: $orca" -ForegroundColor Red; exit 1 }

# Base64 so quotes and Vietnamese text survive the command line.
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($jsPath))
$inject = "(0,eval)(new TextDecoder().decode(Uint8Array.from(atob('$b64'),c=>c.charCodeAt(0))));'installed'"
$check  = "window.__zaloFixInstalled?'yes':'no'"

function Find-ZaloPage {
  $json = (& $orca tab list --json 2>$null) -join "`n"
  if (-not $json) { return $null }
  $found = $null
  function Walk($o) {
    if ($null -eq $o -or $script:found) { return }
    if ($o -is [System.Array]) { foreach ($i in $o) { Walk $i }; return }
    if ($o -is [PSCustomObject]) {
      if ($o.browserPageId -and $o.url -like 'https://chat.zalo.me*') { $script:found = $o.browserPageId; return }
      foreach ($p in $o.PSObject.Properties) { Walk $p.Value }
    }
  }
  $script:found = $null
  Walk ($json | ConvertFrom-Json)
  return $script:found
}

function Invoke-Page($page, $expr) {
  $out = (& $orca eval --page $page --expression $expr --json 2>$null) -join "`n"
  if (-not $out) { return $null }
  try { return ($out | ConvertFrom-Json).result.result } catch { return $null }
}

function Step {
  $page = Find-ZaloPage
  if (-not $page) { return 'no Zalo tab open in Orca' }
  $state = Invoke-Page $page $check
  if ($state -eq 'yes') { return 'ok (already installed)' }
  if ($state -ne 'no') { return 'Zalo tab not ready yet' }
  $r = Invoke-Page $page $inject
  if ($r -eq 'installed') { return 'INSTALLED fix into Zalo tab' }
  return "inject failed ($r)"
}

if (-not $Watch) {
  Write-Host ("[zalo-fix] " + (Step))
  exit 0
}

Write-Host "[zalo-fix] watching every $IntervalSec s (Ctrl+C to stop)"
$last = ''
while ($true) {
  $msg = Step
  if ($msg -ne $last -or $msg -like 'INSTALLED*') {
    Write-Host ("[zalo-fix] " + (Get-Date -Format 'HH:mm:ss') + " " + $msg)
    $last = $msg
  }
  Start-Sleep -Seconds $IntervalSec
}
