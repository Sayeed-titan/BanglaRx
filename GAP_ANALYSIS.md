# BanglaRx gap analysis (2026-10-30)

Scope: whole repo at `main` (2e47e7e). Read-only review of code, config, deploy scripts and docs. Nothing was run in this pass, so every item below is from reading the code, not from a live test. Items marked **(confirm)** need a quick check before acting.

Legend: **P0** fix before any real patient data. **P1** fix before a pilot clinic. **P2** next quarter.

---

## 1. What is solid (keep)

- Server-side doctor isolation is real: `RoleGuardMiddleware.ScopeAsync` forces `doctorId` on queue, prescriptions, templates and bookings, and looks up record owners (`BanglaRx.Api/Auth/RoleGuard.cs`, ~line 150 on).
- Route table is deny-by-default: an unlisted route is manager-only (`RoleGuard.cs`, `RoleRules.Rows`).
- Token check goes to the database on every call (active flag, token version), so a disabled user is cut off at once (`Auth/AuthSetup.cs`).
- Staff and patient tokens use separate audiences; login lockout exists; the service worker never caches `/api` (`frontend/public/sw.js`).
- Design system has an automated guard (contrast, tap size, text size) wired into `prebuild`.
- Safety engine is deterministic, not LLM, and the "never invent clinical data" rule is written down and tested (`tests/run-dictation-tests.mjs`).

---

## 2. P0: data-loss and exposure risks

| # | Gap | Evidence | Fix |
|---|-----|----------|-----|
| 1 | **The deploy runbook tells the operator to run a script that drops the clinical tables.** `init_database.sql` starts with `DROP TABLE ... CASCADE` on patients, doctors, prescriptions, prescription_items, audit_logs, medicines, drug_interactions. Running it on a live DB deletes everything. | `database/init_database.sql:14-22`, `deploy/DEPLOY_RUNBOOK.md:40`, `README.md:274` | Split into `schema.sql` (idempotent, no DROP) and `dev-reset.sql` (DROP, refuses to run unless DB name ends in `_dev`/`_test`). Change the runbook to call only the first. |
| 2 | **Database password is committed.** `Password=123456` with the `postgres` superuser is in the tracked `appsettings.json` and is also the hard-coded fallback in `Program.cs`. | `BanglaRx.Api/appsettings.json:10`, `BanglaRx.Api/Program.cs:74` | Remove both; fail at start-up if no connection string is configured. Use the `banglarx_app` least-privilege user (already in the production example). Rotate the password anywhere it was reused. |
| 3 | **Auth is OFF by default.** Unless `Auth:Enforce=true`, every patient, prescription and queue endpoint is open to anyone who can reach the port. The `.bat` launcher turns it on, but `dotnet run`, IIS with a missing setting, or a typo leaves it open silently. | `Auth/AuthSchema.cs:24`, `RoleGuard.cs` (`!_options.Enforce` branch) | Invert the default: enforce unless `Auth:Enforce=false` AND environment is Development. Log a loud warning at start-up when off. |
| 4 | **Visual Studio cache files are tracked in git** (Copilot index DBs, `applicationhost.config`) although `.gitignore` lists `.vs/`. They were committed before the rule. | `git ls-files | grep .vs/` shows 6 files under `BanglaRx.Api/.vs/` | `git rm -r --cached BanglaRx.Api/.vs`, commit. Check `applicationhost.config` and the code index for local paths or secrets first **(confirm)**. |
| 5 | **Gemini API key travels in the URL query string** (`?key=`). Any HTTP logging, proxy, or exception message that prints the URL leaks it. | `Services/ConsultationAiService.cs:226`, `Rubina/RubinaCore.cs:151`, `PatientApp/ReportsCore.cs:95` | Send it in the `x-goog-api-key` header. One shared helper for the three call sites. |
| 6 | **Patient health data goes to a third-party LLM with no stated lawful basis.** Consultation text, Rubina chat and uploaded report photos are sent to Gemini. There is a consent screen in the patient app, but nothing in the code ties a Gemini call to that consent, and no data-residency or retention statement exists. | `ReportsCore.cs`, `ConsultationAiService.cs`, patient consent endpoints | Decide and document: what leaves the country, under which consent, retention at the vendor. Gate report OCR on a stored consent flag. Needs a legal read, not only code. |

---

## 3. P1: needed before a pilot clinic

**Security and privacy**
- **No audit trail for reads.** `audit_logs` is written for logins, prescription saves and AI calls only. Nobody can answer "who opened this patient's record?" Add read-audit on patient, prescription and report endpoints.
- **No general rate limit.** Only login lockout, patient code requests and Rubina have limits. Staff endpoints and AI calls (cost) are unthrottled. Add ASP.NET `RateLimiter` per user and per IP, with a tight cap on `/api/ai/*`.
- **No HTTPS/HSTS, security headers or global exception handler in the app.** IIS may cover TLS, but nothing in the repo enforces it, and an unhandled exception returns the framework default. Add `UseExceptionHandler` (generic JSON error), HSTS, `X-Content-Type-Options`, a CSP for the SPA.
- **Patient token lives in `localStorage` for 14 days** (`frontend/src/patient/session.ts`). Any XSS reads it. Shorten the lifetime, add refresh, or move to an HTTP-only cookie. Server-side revocation exists (`token_version`), so a "sign out everywhere" button is cheap.
- **Booking scoping gap (confirm).** `ScopeAsync` resolves record owner for `queue` and `prescriptions` only; `/api/bookings/{id}` is not in the owner lookup, so a doctor may read another doctor's booking by id.
- **Patients are shared across doctors** (`GET /api/patients` is any front-desk or clinical role). That may be intended for a multi-doctor clinic, but it contradicts the "strict isolation" wording in the docs. Decide and write it down.
- **Setup endpoint is public until the first manager exists** (`POST /api/auth/setup`). Fine on a private machine; on a public server whoever calls first becomes manager. Require a one-time setup token from config.

**Data and clinical content**
- **Formulary is 63 seed rows, not the 15,000 the docs advertise** (`init_database.sql`). The two-stage retrieval, trigram index and all dictation accuracy numbers are untested at real scale. This is the biggest product risk: the AI can only resolve medicines it has.
- **Drug-interaction rules are a hand-seeded table.** Source, version, owner and review date of the rules are not recorded. For a clinical tool, each rule needs provenance and a reviewer.
- **No schema migrations.** Schema is created by `CREATE TABLE IF NOT EXISTS` in code (34 places) plus a SQL script. Column changes to an existing DB have no versioned path. Adopt a migration tool (DbUp or plain numbered SQL files with a `schema_version` table).
- **Backups exist but restore is untested** in the repo, and backups sit on the same disk by default (`deploy/backup-db.ps1`). Add an off-box copy and a monthly restore drill.

**Quality and process**
- **No CI at all.** No `.github/`. Five backend suites plus dictation tests run only by hand. Add a workflow: build API, typecheck + lint + `check:ds` + build frontend, run the suites against a service Postgres.
- **No unit tests on the frontend, no component tests, no e2e.** The patient and doctor flows are covered only by API tests and manual browser checks.
- **Type check is not in the build.** `tsc` reports 2 errors in `App.tsx` (unused `React`, `setAiMeta`) and the build never runs `tsc`, so type errors can ship. Fix the two, add `tsc -b` to `prebuild`.
- **Lint is configured (oxlint) but not in any script.**
- **`tests/last-results.json` is a committed run artifact.** Remove and git-ignore it.
- **No React error boundary.** One render error in the workbench blanks the whole screen mid-consultation. Add boundaries per route and around the prescription pad.

---

## 4. P2: product and refinement

**Product gaps against your own docs**
- Real SMS gateway not wired live (demo mode shows the code on screen: fine for a showcase, not for patients). Provider interface exists; needs one real provider and delivery failure handling.
- Queue: no wait-time estimate, no "notify me when I am 2 away", no day filter. The patient app honestly says no time is promised: keep that until real data exists.
- Pharmacy: hand-over records exist; stock, dispensing against a prescription line and returns do not.
- Branches and geolocation (TODO section 3 and 4): tables exist partly; nearest-branch search, map and parking info are not built.
- Voice: still browser Web Speech API (Chrome/Edge only, weak on Banglish). The planned streaming STT is not started. Decide the provider and measure word-error-rate on your own dictation set before building.
- Systemic exam, antenatal/natal/vaccination/family history (TODO section 7 D and E) are catalogued but not built.
- Server error messages are English only; the patient app is bilingual.
- Routes are hash-based (`#/patient`): no real URLs, no deep links from SMS, no per-page titles for SEO on the landing page.

**Frontend structure**
- `App.tsx` is 894 lines and still carries legacy workbench logic next to the new shell; `PatientApp.tsx` is 653 lines. Split by route; extract the data hooks.
- 6 legacy design-system violations are held by a ratchet baseline. Burn them down and remove the baseline.
- Accessibility: tap size and contrast are checked automatically; keyboard flow, focus order and screen-reader labels on the prescription pad have no automated check. Add axe to the e2e run.
- Offline: the PWA caches the shell only (correct for privacy). Doctors in poor-connectivity chambers still lose a draft if the tab dies; autosave drafts to IndexedDB, encrypted or cleared on sign-out.

**Backend structure**
- `Endpoints/` use raw SQL in handlers with `dynamic` results (`QueueEndpoints`, `PrescriptionEndpoints`). Typed DTOs would catch column renames at compile time.
- `Booking/`, `PatientApp/`, `Rubina/`, `Auth/` are organised by feature; `Endpoints/` and `Services/` are the older layer-style. Pick one layout and migrate gradually.
- No health check beyond `/api/status`; no structured logging or correlation id; no metrics. Needed once a second clinic is live.
- Multi-tenancy (several clinics on one install) is in the roadmap but nothing in the schema carries a clinic id. Decide now whether it is single-clinic-per-install; retrofitting later is costly.

**Docs**
- `TODO.md`, `MASTER_AGREEMENTS.md` and `README.md` are out of date: they still list RBAC, patient app and responsive work as future, and reference commit `b1384de`. Fold them into one current status doc and archive the rest. `PRESCRIPTION_FOCUS_PLAN.md`, `PRODUCT_FLOW_PLAN.md`, `RESPONSIVE_TODO.md` likewise.
- Unmerged branches `feat/design-system`, `feat/prescription-safety-engine`, `backup-ui-experiment`: either merge or delete to avoid confusion.

---

## 5. Suggested order of work

1. **This week (half a day):** items 1-5 in section 2 (split SQL, remove password, enforce-by-default, untrack `.vs`, key header). All small and mechanical.
2. **Next:** CI + `tsc`/lint in the build + error boundary + read-audit + security headers.
3. **Then:** load the real formulary and re-run the dictation suite at scale; add provenance to interaction rules.
4. **Then:** real SMS provider, migrations tool, patient token hardening.
5. **Product:** pick voice provider after measuring; branches/geo; pharmacy stock.

Decision needed from you: **item 6** (patient data to a third-party LLM) is a policy call, not a code fix.
