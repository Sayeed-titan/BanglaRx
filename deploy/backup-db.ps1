<#
  Nightly database backup. Writes one compressed dump per run and removes dumps older than -KeepDays.
  The password is NOT in this file: put it in %APPDATA%\postgresql\pgpass.conf of the account that runs the task:
      localhost:5432:BanglaRxDB:banglarx_app:THE_PASSWORD
  Copy the backups folder off the server too (a backup on the same disk does not survive the disk).

    powershell -ExecutionPolicy Bypass -File backup-db.ps1
#>
param(
  [string]$BackupDir = 'C:\banglarx\backups',
  [string]$Db = 'BanglaRxDB',
  [string]$PgUser = 'banglarx_app',
  [int]$KeepDays = 14
)

$ErrorActionPreference = 'Stop'
$pgDump = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw 'pg_dump.exe was not found under C:\Program Files\PostgreSQL.' }

New-Item -ItemType Directory -Force $BackupDir | Out-Null
$file = Join-Path $BackupDir ('{0}_{1:yyyyMMdd_HHmm}.dump' -f $Db, (Get-Date))
& $pgDump.FullName -h localhost -U $PgUser -d $Db -F c -f $file
if ($LASTEXITCODE) { if (Test-Path $file) { Remove-Item $file -Force }; throw 'pg_dump failed.' }

Get-ChildItem $BackupDir -Filter '*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Force
Write-Host ('Backup written: {0} ({1:N1} MB)' -f $file, ((Get-Item $file).Length / 1MB))
