# Full-stack workflow (database + API + screen, together)

Every feature is one vertical slice. A slice is not done until all four parts exist and work together.

| Part | Where | Rule |
| --- | --- | --- |
| 1. Database | a `*Schema.cs` class in `BanglaRx.Api/Data/`, called from `Program.cs` | Idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), only adds. Derive seed rows from data that already exists. Never invent clinical or business data. |
| 2. API | an `*Endpoints.cs` class in `BanglaRx.Api/Endpoints/` | Validate everything on the server (ranges, order, overlaps, unknown ids). A rejected save changes nothing. Return `{ errors: [...] }` in plain language. |
| 3. Tests | `tests/run-api-tests.mjs` | Real PostgreSQL, real API, real HTTP. Covers the happy path, every rejection, and that old features still work. |
| 4. Screen | `frontend/src/pages/*Page.tsx` | Built from `frontend/src/design-system`. Reads and writes through `frontend/src/api.ts`. Shows server errors next to the form. Never shows a number the database did not give it. |

## Commands

```bash
node tests/run-api-tests.mjs            # schedules and the older features, sign-in off (about 10 seconds)
node tests/run-auth-tests.mjs           # sign-in, roles, doctor isolation, lockout, audit (about 20 seconds)
node tests/run-booking-tests.mjs        # slots, booking, double-booking race, move, cancel, arrive, no-show (about 25 seconds)
node tests/run-patient-tests.mjs        # patient phone-code sign-in, family profiles, patient booking, SMS gateway (about 45 seconds)
cd frontend && npm run check:ds         # design guard (also runs before every build)
cd frontend && npm run build
```

To try a screen against a throw-away back end instead of your real data:

```bash
node tests/start-test-stack.mjs                                   # own database + API on :5155 (RX_TEST_ENFORCE=1 to require sign-in, RX_TEST_SMS=1 to read patient codes at GET /api/_test/sms?phone=%2B880...)
cd frontend && VITE_API_BASE=http://localhost:5155/api node node_modules/vite/bin/vite.js --port 5199
node tests/stop-test-stack.mjs                                    # stops the API and drops the database
```

## Safety

- The test stack never touches `BanglaRxDB` or the API you run with `start_banglarx.bat`. It creates `banglarx_test_<time>`, uses port 5155 and a separate build folder, and drops the database when it stops.
- New tables appear in your real database the next time you start the API (schema classes run on startup). They are additive: no existing table loses a column or a row.
- Anything that writes to the real database (signing a prescription, registering a patient) is only ever run by hand or against the test stack.

## Slices so far

| Slice | Database | API | Screen |
| --- | --- | --- | --- |
| Doctors and schedules | `branches`, `specialties`, `doctor_schedules`, doctor fee / online booking / leave | `/api/branches`, `/api/specialties`, `/api/schedules`, `PUT /api/doctors/{id}/schedule` | `#/schedules` |
| Booking | `bookings` (own table; unique index on live doctor + date + time) | `/api/slots`, `/api/bookings` (+ move, cancel, arrive, no-show), `/api/booking/info` | `#/bookings` |
| Patient sign-in and booking | `patient_accounts`, `patient_account_profiles`, `otp_codes` | `/api/patient/auth/*`, `/api/patient/{me,profiles,doctors,slots,bookings,queue}` | `#/patient` (Bangla first, English toggle) |
| Sign-in and roles | `users`, `auth_events`, `app_secrets` (token signing key) | `/api/auth/*`, `/api/users/*`, `/api/pharmacy/*`; role table in `Auth/RoleGuard.cs` | sign-in / setup / first-password screens, `#/users`, the account pill |

| Rubina public chat | `chat_conversations`, `chat_messages` | `/api/public/chat`, `/api/public/doctors` (no sign-in) | `#/rubina` |
| Reception inbox | same tables | `/api/inbox` (receptionist, manager) | `#/inbox` |
| Rx Sathi (doctor's assistant) | none (reads patient + formulary) | `POST /api/sathi/chat` (doctor, assistant) | "Ask Rx Sathi" panel in the workbench |
| Consent | `patient_consents`, `patient_consent_log` | `/api/patient/consent`, `GET /api/patients/{id}/consent` | patient "My permissions"; the doctor's mic follows it |
| Patient prescriptions | reads `prescriptions` | `GET /api/patient/prescriptions` | patient "My prescriptions" |
| Patient reports | `patient_reports`, `patient_report_reads` | `/api/patient/reports/*`, `GET /api/patients/{id}/reports` | patient "My reports", doctor side card |
| Hand-over records | `dispense_records` | `/api/pharmacy/prescriptions/{id}/dispense`, `GET /api/prescriptions/{id}/history` | `#/pharmacy`, History button on the pad |
| Installable app | none | none | `manifest.webmanifest`, `sw.js` (never caches `/api`) |

## How the newer slices behave

- **Rubina** answers only from live doctor data. Red-flag words (chest pain, breathing trouble, bleeding, seizure, poisoning...) are caught by fixed rules before the model runs and get the 999 / emergency message. Limits: 500 characters a message, 20 messages per 10 minutes per address, `Rubina:DailyMessageCap` a day. Reception sees the chat in `#/inbox`, takes over, and the patient sees the reply.
- **Rx Sathi** never receives the patient's name or phone. Only formulary medicines become cards, allergy conflicts are removed by fixed rules, and adding a card leaves dosage and duration for the doctor.
- **Consent**: "No" to recording turns the doctor's microphone off for that patient (typing still works). Every answer is logged with its date.
- **Reports**: the photo is read and thrown away. Values are kept only after the patient corrects any `?` and confirms, and only if "Keep my reports" is on. Doctors see them as "patient-given, AI-read".
- **Hand-over**: one record per medicine per prescription version; if the doctor revises the prescription later, the pharmacy sees a warning. Undo works for 15 minutes.
- **Phones**: the workbench shows Consultation or Rx one at a time below 900 px. The service worker is registered in production builds only.
- **Public and internal screens**: `#/` is the public home page (patients, doctors, clinics, an estimator that only does arithmetic on the clinic's own numbers). `#/rubina` and `#/patient` are public too. Every other address is internal: without a staff sign-in it goes to `#/login`, and a signed-in person is sent to their own home if their role may not open it. The doctor's workbench moved from `#/` to `#/workbench`. All internal screens sit in one frame with a role-based sidebar that collapses to icons (remembered) and slides in on a phone. `start_banglarx.bat` sets `Auth__Enforce=true` so the server refuses internal calls without a token; on first run the setup screen creates the manager account.
- **Showcase mode**: `Sms__Provider=demo` (set by `start_banglarx.bat`) shows the sign-in code on screen. Turn it off for any real use.

## Sign-in and roles: how it works

- **Roles:** doctor, assistant, receptionist, pharmacist, manager. The one table of who may call what is `BanglaRx.Api/Auth/RoleGuard.cs` (`RoleRules.Rows`). A route that matches no row is manager-only, so a new endpoint stays locked until someone decides who may use it. Add a row (and a test) with every new endpoint.
- **Doctor isolation:** a doctor, and the assistant working for that doctor, only ever reach their own queue, prescriptions and templates. The server enforces it; hiding things in the screen is not the rule.
- **Switch:** `Auth:Enforce` (default **true** since 2026-10-30). Set it to `false` only on a private development machine; the API then logs a warning at start-up and behaves as it did before sign-in existed, except that the user list and the sign-in log stay manager-only.
- **Turning it on, safely:**
  1. Start the app and open `#/login`. With no accounts yet it shows the setup screen: you choose the first manager's username and password (nobody else, and no code, ever sees it).
  2. In `#/users`, add everyone else. Each gets a temporary password and must choose their own at first sign-in.
  3. Nothing to switch on: sign-in is required everywhere by default. (To work without it on a private machine, put `{ "Auth": { "Enforce": false } }` in `BanglaRx.Api/appsettings.local.json`.)
- **Passwords:** PBKDF2-SHA256, 210,000 rounds, random salt. 5 wrong tries lock an account for 15 minutes. Signing out, a password change, a role change, or switching a person off ends all of their sessions at once. Tokens last 12 hours and live in the browser tab only.
- **Token signing key:** `Auth:JwtSecret` if you set one, otherwise a random key generated once and kept in the `app_secrets` table.

## Booking: how it works

- **Bookings are separate from the queue.** `bookings` holds future and today's appointments. The queue (`appointments`) holds people who are physically here. **Arrived** turns a booking into the next token for that doctor (one at a time per doctor, so two check-ins never share a number).
- **Times come from the doctor's schedule** (`#/schedules`): each session is cut into equal slots. A time is offered only if the doctor has a session that weekday, is not on leave, the branch is switched on, nobody else holds it, and it is at least 15 minutes away and within 30 days. The server says why when a day has nothing.
- **No double booking, ever.** The check is also in the database: a unique index on live bookings (doctor, date, time). Eight people choosing one slot at the same moment get exactly one winner; the rest get "just taken" and leave nothing behind (a new patient created for a losing attempt is rolled back).
- **One live booking per patient, per doctor, per day.** Cancelled and no-show bookings free the person to book again.
- **Online channels** (WhatsApp, app, web) can only book doctors who switched "Patients can book online" on. The front desk and phone are not restricted.
- **Who:** front desk and manager book, move, cancel, check in. A doctor or assistant reads only their own doctor's bookings. Pharmacists see none.
- **Clock:** all times are clinic time (UTC+6, `Booking:UtcOffsetHours`). `Booking:MinLeadMinutes` (15) and `Booking:MaxDaysAhead` (30) are settings. `Booking:FakeNow` freezes the clock and is for tests only.
- **Patients book through the same rules** (see below), so they obey the same limits.

## Patient sign-in and the patient app: how it works

- **Sign in with a phone code, no password.** The patient enters a Bangladesh mobile number; the server texts a 6-digit code (valid 5 minutes, one use, newest code only). Five wrong guesses kill the code. At most 3 codes per number and 20 per address in 10 minutes. The reply never says whether the number is known, and the code is stored only as a keyed hash.
- **A patient token is not a staff token.** Separate audience (`banglarx-patients`), 14 days, revoked on sign-out. Patient routes (`/api/patient/**`) accept only it; staff routes refuse it. They work whether or not staff sign-in is enforced.
- **Who they see:** records the clinic already holds under the verified number are linked to the account automatically. A patient can add family members (up to 10) under the same number. They only ever see their own people's bookings, and in the queue only counts: their token, who is being served, how many wait ahead. No wait time is promised because none is measured.
- **Booking:** doctors who switched on "Patients can book online" and have a schedule; only free times; same rules as the desk (no double booking, one per person per doctor per day), plus at most 5 upcoming appointments per account. Cancelling is allowed up to 2 hours before; later, they are told to call the clinic.
- **Sending the SMS** is configured in `appsettings.local.json` (never committed): `Sms:Provider` is `log` (default, **development only**: the code is written to the API log, nothing is sent), `http` (a generic gateway: `Sms:Url`, `Sms:Body` with `{to}` and `{message}`, `Sms:AuthHeaderName`/`Sms:AuthHeaderValue`) or `test` (tests only). The http body format must be checked against your SMS provider's documentation; it has only been tried against a mock gateway. If the gateway fails, the patient is told and that code is cancelled.
- **Not built yet:** Rubina AI chat (needs the LLM), real SMS gateway account, WhatsApp channel, Bangla translation of server messages (they are English).

## Next slices (from PRODUCT_FLOW_PLAN.md)

1. Rubina chat on top of the patient booking rules above.
2. Dispense records: pharmacy ticks saved against a prescription.
3. Day filter on the queue (it currently lists every day).
