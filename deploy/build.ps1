<#
  Builds everything that goes to the server, on your own computer:
    deploy\out\web   the website (React build, with web.config and the app files)
    deploy\out\api   the API, published for Release

  Run from anywhere:   powershell -ExecutionPolicy Bypass -File deploy\build.ps1
  Needs: Node 20+, the .NET SDK. Nothing secret is ever put in the output.
#>
param([string]$Out = (Join-Path $PSScriptRoot 'out'))

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $Out 'web'), (Join-Path $Out 'api') | Out-Null

# 1. website: it talks to the API on its own address, so the API base is just /api
Push-Location (Join-Path $root 'frontend')
try {
  if (-not (Test-Path 'node_modules')) { npm ci; if ($LASTEXITCODE) { throw 'npm ci failed' } }
  node scripts/check-design-system.mjs
  if ($LASTEXITCODE) { throw 'the design-system check failed' }
  $env:VITE_API_BASE = '/api'
  node node_modules/vite/bin/vite.js build --outDir (Join-Path $Out 'web') --emptyOutDir
  if ($LASTEXITCODE) { throw 'the web build failed' }
}
finally {
  Remove-Item Env:VITE_API_BASE -ErrorAction SilentlyContinue
  Pop-Location
}

# 2. API
dotnet publish (Join-Path $root 'BanglaRx.Api\BanglaRx.Api.csproj') -c Release -o (Join-Path $Out 'api') --nologo
if ($LASTEXITCODE) { throw 'the API publish failed' }

# 3. never ship this machine's settings or secrets
Get-ChildItem (Join-Path $Out 'api') -Filter 'appsettings.local.json' -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem (Join-Path $Out 'api') -Filter 'appsettings.Development.json' -ErrorAction SilentlyContinue | Remove-Item -Force
# the API is not hosted inside IIS (it is a service), so the web.config that publish adds is not wanted
Get-ChildItem (Join-Path $Out 'api') -Filter 'web.config' -ErrorAction SilentlyContinue | Remove-Item -Force

if (-not (Test-Path (Join-Path $Out 'web\web.config'))) { throw 'web.config is missing from the web build' }
if (-not (Test-Path (Join-Path $Out 'web\index.html'))) { throw 'index.html is missing from the web build' }

Write-Host ''
Write-Host "Built:  $Out\web  and  $Out\api" -ForegroundColor Green
Write-Host 'Next: copy the "out" folder to the server and run deploy\release.ps1 there (see DEPLOY_RUNBOOK.md).'
