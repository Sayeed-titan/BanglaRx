# Deploy runbook: one Windows VM, IIS, our domain

What is in this folder, and what each file does:

| File | Run where | What it does |
| --- | --- | --- |
| `build.ps1` | your computer | builds the website and the API into `deploy\out` |
| `install-api-service.ps1` | the server, once | makes the folders, installs the API as a Windows service, opens ports 80 and 443 only |
| `release.ps1` | the server, each update | puts a new build live in a minute; `-Rollback` goes back |
| `backup-db.ps1` | the server, nightly | database backup with 14 days kept |
| `appsettings.production.example.json` | the server | the settings file you fill in (never committed) |
| `..\frontend\public\web.config` | built into the site | https, the `/api` forward, the app's pages, security headers, caching |

**Status:** these files were written and checked for syntax and for the web and API build, but they have **not yet been run on a real server**. Do the first install on the VM with this runbook open and tell me where anything differs.

## 1. The server

- Windows Server 2019/2022, 4 vCPU, 8 GB RAM, 80 GB SSD. A static public IP.
- DNS: an `A` record for `app.<your-domain>` to the server's IP.
- Windows Update done, RDP limited to your office IP, no other ports open to the internet.

## 2. Install once

1. **IIS** (PowerShell as Administrator):
   ```powershell
   Install-WindowsFeature Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Filtering, Web-Mgmt-Console
   ```
2. **IIS add-ons**: install **URL Rewrite** and **Application Request Routing (ARR)** (Microsoft downloads, `.msi`).
   Then in IIS Manager, click the server name, open **Application Request Routing Cache**, **Server Proxy Settings**, tick **Enable proxy**, Apply.
3. **.NET 8 ASP.NET Core Runtime** (not the SDK).
4. **PostgreSQL 18** on this machine, listening on localhost only (the default). Then:
   ```sql
   CREATE USER banglarx_app WITH PASSWORD 'CHANGE_ME';
   CREATE DATABASE "BanglaRxDB" OWNER banglarx_app;
   \c BanglaRxDB
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```
   Load the base tables **once, into the empty database only** (the script drops and recreates its tables):
   ```powershell
   psql -h localhost -U banglarx_app -d BanglaRxDB -f database\init_database.sql
   ```
   The API creates its own newer tables the first time it starts.
5. **NSSM** (the service wrapper): unzip to `C:\tools\nssm\`.
6. Run `install-api-service.ps1` as Administrator.
7. **Settings**: copy `appsettings.production.example.json` to `C:\banglarx\api\appsettings.local.json` and replace every `CHANGE_ME`
   (database password, Gemini key, the domain, a long random `Auth:JwtSecret`, the SMS gateway). Restrict the file so only Administrators and the service account can read it.
8. **The IIS site**: create a site named `banglarx`, physical path `C:\banglarx\web`, bindings for `app.<your-domain>` on 80 and 443.
9. **The certificate**: use **win-acme** (Let's Encrypt), choose the `banglarx` site. It installs the certificate and renews it on a schedule.

## 3. Every release

On your computer:
```powershell
powershell -ExecutionPolicy Bypass -File deploy\build.ps1
```
Copy `deploy\out` to the server (for example `C:\drop\out`), then on the server:
```powershell
powershell -ExecutionPolicy Bypass -File C:\banglarx\release.ps1 -From C:\drop\out
```
It stops the service, keeps the old version, copies the new one, starts the service and checks `http://127.0.0.1:5000/api/status`.
If the check fails it goes back by itself. To go back by hand: `release.ps1 -Rollback`.

## 4. First run

1. Open `https://app.<your-domain>/#/login`. With no accounts yet it shows the setup screen: choose the first manager's username and password.
2. Sign in, open **Users and access**, add the doctors, receptionist and pharmacist (each gets a temporary password and must change it at first sign-in).
3. Open **Doctors and schedules**: add branches, then each doctor's sessions, fee, and switch on "Patients can book online".
4. Open the public page `https://app.<your-domain>/` and try Rubina and the patient sign-in from a phone on mobile data.

## 5. Backups

Create `%APPDATA%\postgresql\pgpass.conf` for the account that runs the task:
```
localhost:5432:BanglaRxDB:banglarx_app:THE_PASSWORD
```
Schedule it nightly at 02:00 and test one restore:
```powershell
schtasks /Create /TN "BanglaRx backup" /SC DAILY /ST 02:00 /RU SYSTEM /TR "powershell -ExecutionPolicy Bypass -File C:\banglarx\backup-db.ps1"
# restore test, into a scratch database:
pg_restore -h localhost -U banglarx_app -d BanglaRx_restore_test --clean --if-exists C:\banglarx\backups\BanglaRxDB_YYYYMMDD_HHMM.dump
```
Copy `C:\banglarx\backups` to another machine or storage as well.

## 6. Check after every release

- [ ] `https://app.<your-domain>/` shows the home page and the padlock.
- [ ] `http://app.<your-domain>/` redirects to https.
- [ ] `https://app.<your-domain>/#/workbench` while signed out goes to the sign-in page.
- [ ] `https://app.<your-domain>/api/queue` without signing in answers `401`.
- [ ] `https://app.<your-domain>/api/public/doctors` answers `200` with your doctors.
- [ ] `http://<server-ip>:5000` and `<server-ip>:5432` do **not** answer from outside.
- [ ] A patient sign-in code really arrives by SMS (the on-screen demo code only exists when `Sms:Provider` is `demo`).
- [ ] A voice prescription works on https (the microphone needs https).
- [ ] The app can be installed from a phone, and `C:\banglarx\logs` has no errors.

## 7. Where things are

```
C:\banglarx\api         the API (appsettings.local.json lives here, never overwritten by a release)
C:\banglarx\web         the website
C:\banglarx\api_prev    the previous API, for a rollback
C:\banglarx\web_prev    the previous website
C:\banglarx\logs        api.out.log and api.err.log (rotated at 10 MB)
C:\banglarx\backups     nightly database dumps
```
