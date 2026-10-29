# BanglaRx AI - Showcase Deployment Plan (one VM, our domain, PWA)

Goal: for the AI summit it must look and behave like a real product. No "demo" banners,
no fake data, no localhost. Real HTTPS domain, real sign-in, installable on a phone.

## 1. One app or many? (decision)

RECOMMENDED: ONE web app, ONE API, ONE database, different screens per role.

  Why: one deploy, one login system, one PWA icon, shared look. The code is already split
  by area (patient/, staff pages, pharmacy), so we can still split later with no rewrite.

  Option A (recommended)   one site, role decides the screens
  Option B (later)         same code, separate sub-domains and separate PWA icons
                           (patient.domain, staff.domain). Only a build setting changes.
  Option C (not now)       separate codebases per audience. More work, no benefit today.

## 2. Who sees what

  PUBLIC (no login)        website + "Rubina" AI chat: which doctor, where, when, fees, FAQ
  PATIENT (phone code)     book, family profiles, my bookings, live queue, my prescriptions
  DOCTOR / ASSISTANT       queue, AI scribe, prescription pad, templates, own schedule
  RECEPTION                bookings, check-in, patient registration
  PHARMACY                 prescriptions to dispense
  MANAGER / IT             users and roles, schedules, branches, dashboard, sign-in log

  Already built: sign-in, roles table (Auth/RoleGuard.cs), phone-code login, booking.
  Role = what the menu shows AND what the API allows (server enforces, screen only hides).

## 3. Patient journey (public chat -> login -> book)

  open https://<domain>
     |
     v
  Rubina chat (anonymous)  "my child has fever 3 days"
     |   AI asks 2-3 questions, then suggests: specialty + doctor + branch + next free slot
     |   answers any question about hours, fees, address, how to come
     v
  [ Book this slot ]
     |
     v   (only now) phone number -> 6-digit SMS code -> signed in
     |   the chat context and the chosen slot are kept, nothing to retype
     v
  who is it for (me / family) -> confirm -> booking saved -> reminder SMS
     v
  on the day: "Arrived" at desk -> token -> live queue on the phone

## 4. Rubina (public AI) - separate from the doctor's scribe

  Separate prompt, separate endpoint (POST /api/public/chat), separate rules:
   - Knows ONLY: doctors, specialties, schedules, branches, fees, FAQ. No patient records.
   - Suggests a specialty and doctor. NEVER diagnoses, NEVER names medicines or doses.
   - Red flags (chest pain, breathing trouble, heavy bleeding, unconscious, pregnancy
     emergency): tells them to go to the nearest emergency or call 999. No booking talk.
   - Bangla first, English if the user writes English.
   - Anonymous, so: rate limit per IP, max message length, daily cost cap, no personal
     data stored in chat logs (or the log is stripped of phone numbers/names).
   - Doctor list comes from the database (live), never from the model's memory.
  Dictation test file for the scribe stays as is. Rubina gets its own test set
  (e.g. 30 patient messages -> expected specialty, and emergency messages -> must escalate).

## 5. How the parts talk to each other

                         Internet (HTTPS 443)
                                 |
                      +----------------------+
                      |  Web server / proxy  |   TLS certificate (Let's Encrypt)
                      |  (IIS or Caddy)      |
                      +----------+-----------+
                                 |
          +----------------------+-----------------------+
          | /            static files (React build, PWA files)
          | /api/*  ---->  ASP.NET Core API  (127.0.0.1:5000, Windows service)
          +----------------------+-----------------------+
                                 |
                  +--------------+---------------+---------------+
                  |              |               |               |
             PostgreSQL     Gemini (LLM)     SMS gateway     (later) WhatsApp
             127.0.0.1:5432  outbound HTTPS   outbound HTTPS

  - Browser talks ONLY to the proxy. API, database are not reachable from outside.
  - Same domain for page and API, so no CORS problem and cookies/tokens stay simple.
  - Tokens: staff audience and patient audience are different (already built).

## 6. The VM

  Assumed: Windows Server VM (matches earlier deployments: IIS + NSSM). If it is Linux,
  swap IIS/NSSM for Caddy/nginx + systemd; everything else is identical.

  Size to start: 4 vCPU, 8 GB RAM, 80 GB SSD.
  Installed: .NET 8 hosting bundle, PostgreSQL 18 (+ pg_trgm), Node only on the build
  machine (not needed on the VM), reverse proxy, win-acme (certificates).

  Folders:
    C:\banglarx\api\          published API
    C:\banglarx\web\          React build output (dist)
    C:\banglarx\backups\      nightly database dumps
    C:\banglarx\logs\
  Secrets (Gemini key, DB password, SMS key, JWT secret) live in
  C:\banglarx\api\appsettings.local.json - never in git, never in the web folder.

## 6b. IIS setup (decided: Windows VM + IIS)

  IIS features: Web-Server, Static Content, Default Document, HTTP Errors, Request Filtering,
  plus the add-ons URL Rewrite and Application Request Routing (ARR).

  One IIS site "banglarx", bindings 80 + 443 for the domain:
    physical path  C:\banglarx\web   (React build output)
    web.config (in C:\banglarx\web):
      1. Rule "api"  : match ^api/(.*)  ->  rewrite to http://127.0.0.1:5000/api/{R:1}  (ARR proxy on)
      2. Rule "spa"  : any other URL that is not a real file  ->  /index.html
         (so /patient, /queue, refresh and shared links all work)
      3. Rule "https": http -> https redirect
      4. Headers     : HSTS, X-Content-Type-Options, X-Frame-Options, CSP
      5. MIME        : .webmanifest = application/manifest+json
      6. Cache       : index.html and sw.js never cached; hashed assets cached for a year

  API: not inside IIS. Runs as a Windows service on 127.0.0.1:5000 with NSSM
    nssm install BanglaRxApi "C:\Program Files\dotnet\dotnet.exe" "C:\banglarx\api\BanglaRx.Api.dll"
    app directory C:\banglarx\api, start = automatic, restart on failure, log to C:\banglarx\logs
    (nothing outside the VM can reach port 5000; Windows Firewall allows only 80/443)
  Why not host the API in IIS: our routes already start with /api, so mounting it as an IIS
  application would double the prefix; the service + proxy is simpler to restart and debug.

  Release steps (each update, about 5 minutes):
    1. build machine: npm run build with VITE_API_BASE=/api ;  dotnet publish -c Release
    2. copy dist -> C:\banglarx\web  (keep web.config), publish -> C:\banglarx\api
    3. nssm restart BanglaRxApi ; open https://<domain>/api/status ; open the site
  Keep the previous folder as web_prev / api_prev for a one-minute rollback.

  Certificates: win-acme (Let's Encrypt) bound to the IIS site, auto-renew scheduled task.

## 7. Domain and HTTPS

  Option 1 (simplest):   https://banglarx.<our-domain>   everything on one name
  Option 2 (later):      app.<domain> (patients), staff.<domain> (clinic) - same server
  Steps: DNS A record -> VM public IP; open ports 80 and 443 only; certificate via
  win-acme / Caddy with auto-renew. HTTPS is mandatory: PWA install and the microphone
  (doctor voice scribe) both refuse to work on plain http.

## 8. PWA (installable, opens like a mobile app)

  Needs: manifest.webmanifest (name, icons 192/512 + maskable, theme colour,
  start_url, display=standalone), a small service worker, HTTPS.
  - Cache only the app shell (JS/CSS/icons/fonts). NEVER cache /api responses
    (patient data must not sit on the phone). Offline shows a friendly "no connection".
  - One icon. After login the app opens the role's home (patient -> bookings,
    doctor -> queue). Same install works for everyone.
  - Switch the router from #/hash to real paths (/patient, /queue) so links, shared URLs
    and the install start_url look professional. Proxy returns index.html for unknown paths.
  - Update flow: new build -> service worker updates quietly on next open.

## 9. Make it look real (checklist)

  [ ] Real SMS (not on-screen code). Cheapest real option: Android phone as gateway or a
      BD provider test credit. Remove Sms:Provider=demo from the launcher for the event.
  [ ] No "Demo", "Test", "Draft (not saved)" wording in visible UI; clinic name, logo,
      address, phone, BMDC numbers real-looking and consistent.
  [ ] Seed realistic data: 6-10 doctors with real schedules, 2 branches, fees, photos,
      medicines (the 15K dataset once the limited-data behaviour is signed off).
  [ ] Auth:Enforce = true, first manager created, one login per role for the live demo.
  [ ] Remove old test patients/prescriptions; keep a few believable ones.
  [ ] Custom 404/offline pages, favicon, page titles, <html lang="bn">.
  [ ] Print layout (A4 prescription) checked on the real printer.

## 10. Security must-dos before going public

  1. CORS: replace AllowAnyOrigin with our domain only (Program.cs).
  2. Auth:Enforce true; strong manager password; JWT secret set.
  3. Public chat: rate limit, size limit, cost cap, no PHI in prompts or logs.
  4. Firewall: only 80/443 inbound; Postgres bound to localhost; RDP restricted by IP.
  5. Frontend built with VITE_API_BASE=/api (api.ts defaults to http://localhost:5000/api).
  6. Nightly pg_dump + copy off the VM; test one restore.
  7. Security headers on the proxy (HSTS, no-sniff, frame-deny, CSP).
  8. Medical wording: Rubina and the pad show "AI assistance, doctor decides" in small print.

## 11. Build order (quickest to a real-looking showcase)

  Step 1  Rubina public chat + doctor finder (specialty -> soonest slot) + login at "Book"
  Step 2  Real paths instead of #/ routes, PWA manifest + service worker + icons
  Step 3  Production config: VITE_API_BASE, CORS, Auth:Enforce, appsettings.local.json
  Step 4  VM: install, publish API as service, proxy, domain, TLS, backups
  Step 5  Real SMS, realistic seed data, branding polish
  Step 6  Full rehearsal on the phone over mobile data; staff + patient + doctor flows
  Step 7  Freeze 2 days before the event; only fixes after that

## 12. Open questions for the owner

  - Windows or Linux VM, and who owns the domain / DNS?
  - Which SMS route for the event (Android gateway vs provider)?
  - Which languages on Rubina: Bangla + English only?
  - Name and logo of the clinic/hospital shown to visitors.
