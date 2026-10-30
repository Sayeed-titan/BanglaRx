<#
  One-time, on the server, as Administrator. Creates the folders, installs the API as a Windows service (NSSM),
  and opens only ports 80 and 443. The API listens on 127.0.0.1:5000, so it cannot be reached from outside.

    powershell -ExecutionPolicy Bypass -File install-api-service.ps1 -Nssm C:\tools\nssm\nssm.exe
#>
#Requires -RunAsAdministrator
param(
  [string]$Root = 'C:\banglarx',
  [string]$Nssm = 'C:\tools\nssm\nssm.exe',
  [string]$Service = 'BanglaRxApi'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $Nssm)) { throw "nssm.exe not found at $Nssm. Download NSSM and pass its path with -Nssm." }
$dotnet = Join-Path $env:ProgramFiles 'dotnet\dotnet.exe'
if (-not (Test-Path $dotnet)) { throw 'dotnet.exe not found. Install the .NET 8 ASP.NET Core Runtime first.' }

foreach ($d in 'api', 'web', 'logs', 'backups') { New-Item -ItemType Directory -Force (Join-Path $Root $d) | Out-Null }

# the update and backup scripts live next to the app, so they are always in the root folder
foreach ($f in 'release.ps1', 'backup-db.ps1') { Copy-Item (Join-Path $PSScriptRoot $f) $Root -Force }

if (-not (Get-Service $Service -ErrorAction SilentlyContinue)) {
  & $Nssm install $Service $dotnet (Join-Path $Root 'api\BanglaRx.Api.dll')
  if ($LASTEXITCODE) { throw 'nssm install failed' }
}
& $Nssm set $Service AppDirectory (Join-Path $Root 'api')
& $Nssm set $Service AppEnvironment 'ASPNETCORE_URLS=http://127.0.0.1:5000' 'ASPNETCORE_ENVIRONMENT=Production'
& $Nssm set $Service Start SERVICE_AUTO_START
& $Nssm set $Service AppExit Default Restart
& $Nssm set $Service AppRestartDelay 5000
& $Nssm set $Service AppStdout (Join-Path $Root 'logs\api.out.log')
& $Nssm set $Service AppStderr (Join-Path $Root 'logs\api.err.log')
& $Nssm set $Service AppRotateFiles 1
& $Nssm set $Service AppRotateBytes 10485760

# only the web ports are opened; there is deliberately no rule for 5000 or 5432
if (-not (Get-NetFirewallRule -DisplayName 'BanglaRx web (80,443)' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'BanglaRx web (80,443)' -Direction Inbound -Protocol TCP -LocalPort 80, 443 -Action Allow | Out-Null
}

Write-Host "Service $Service is installed. It starts after the first release (deploy\release.ps1)." -ForegroundColor Green
