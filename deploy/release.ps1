<#
  Each update, on the server, as Administrator. Takes the "out" folder made by build.ps1 and puts it live in a minute.
  The previous version is kept (web_prev, api_prev) so you can go back with -Rollback.

    powershell -ExecutionPolicy Bypass -File release.ps1 -From C:\drop\out
    powershell -ExecutionPolicy Bypass -File release.ps1 -Rollback

  Your settings file (api\appsettings.local.json) is never touched.
#>
#Requires -RunAsAdministrator
param(
  [string]$From,
  [switch]$Rollback,
  [string]$Root = 'C:\banglarx',
  [string]$Service = 'BanglaRxApi'
)

$ErrorActionPreference = 'Stop'
$api = Join-Path $Root 'api'; $web = Join-Path $Root 'web'
$apiPrev = Join-Path $Root 'api_prev'; $webPrev = Join-Path $Root 'web_prev'
$settings = Join-Path $api 'appsettings.local.json'

function Test-Health {
  for ($i = 0; $i -lt 30; $i++) {
    try { if ((Invoke-WebRequest 'http://127.0.0.1:5000/api/status' -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200) { return $true } } catch { }
    Start-Sleep -Seconds 1
  }
  return $false
}

if ($Rollback) {
  if (-not ((Test-Path $apiPrev) -and (Test-Path $webPrev))) { throw 'There is no previous version to go back to.' }
  Stop-Service $Service -ErrorAction SilentlyContinue
  $keep = if (Test-Path $settings) { Get-Content $settings -Raw } else { $null }
  Remove-Item $api, $web -Recurse -Force
  Move-Item $apiPrev $api; Move-Item $webPrev $web
  if ($keep) { Set-Content -Path $settings -Value $keep -NoNewline }
  Start-Service $Service
  if (-not (Test-Health)) { throw 'Rolled back, but the API did not answer. Check C:\banglarx\logs.' }
  Write-Host 'Rolled back to the previous version.' -ForegroundColor Yellow
  return
}

if (-not $From -or -not (Test-Path (Join-Path $From 'web\index.html')) -or -not (Test-Path (Join-Path $From 'api\BanglaRx.Api.dll'))) {
  throw 'Give -From the "out" folder made by build.ps1 (it must contain web\index.html and api\BanglaRx.Api.dll).'
}
if (-not (Test-Path $settings)) { throw "Missing $settings. Create it from deploy\appsettings.production.example.json first." }

Stop-Service $Service -ErrorAction SilentlyContinue

# keep the current version for a rollback, then bring the new one in
foreach ($p in $apiPrev, $webPrev) { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }
$keep = Get-Content $settings -Raw
Copy-Item $api $apiPrev -Recurse
Copy-Item $web $webPrev -Recurse

Remove-Item (Join-Path $api '*') -Recurse -Force
Copy-Item (Join-Path $From 'api\*') $api -Recurse -Force
Set-Content -Path $settings -Value $keep -NoNewline

Remove-Item (Join-Path $web '*') -Recurse -Force
Copy-Item (Join-Path $From 'web\*') $web -Recurse -Force

Start-Service $Service
if (Test-Health) {
  Write-Host 'The new version is live.' -ForegroundColor Green
}
else {
  Write-Host 'The API did not answer. Going back to the previous version...' -ForegroundColor Red
  & $PSCommandPath -Rollback -Root $Root -Service $Service
  throw 'Release failed and was rolled back. Check C:\banglarx\logs\api.err.log.'
}
