# BanglaRx AI - End-to-End Product Flow Plan (DRAFT v1)

Goal: one AI platform connecting Patient, Receptionist, Doctor, Pharmacy, Branch Manager.

## 0. THE BIG PICTURE

  PATIENT/FAMILY                 CLINIC                         AFTER VISIT
  --------------                 ------                         -----------
  [1 BOOK]  ------------------>  [3 WAIT/QUEUE] ------------->  [6 FOLLOW-UP]
  web chat / WhatsApp / call     live serial, doctor present    reminders, replay,
  AI "Rubina" talks, books       |                              reports upload
       |                         v
  [2 CONFIRM]                    [4 CONSULT] --> [5 PRESCRIPTION]
  SMS + Email + WhatsApp         doctor<->patient talk,         AI drafts, doctor/assistant
  + QR token                     audio recorded (w/ consent)    edits everything (full CRUD)

  Everything reads/writes ONE PostgreSQL vault (already exists).

## 1. BOOKING AI ("Rubina") - Phase A

  Patient opens: Website chat | WhatsApp | (later) hotline | (later) mobile app
        |
        v
  [Voice/Text in Bangla]  --STT-->  [LLM: extract name, age, gender, phone, symptoms]
        |
        v
  [RED-FLAG CHECK]  chest pain / stroke signs / heavy bleeding / child fits ...
        |-- YES --> "Go to emergency NOW" + show nearest ER + alert branch. STOP booking flow.
        |-- NO  --v
  [Symptoms -> Specialty]   (suggestion only; patient can override)
        |
  [Ask preferences]  branch (GPS/area), male/female doctor, language, time of day, fee limit
        |
  [Query DB]  doctor_branches schedules + free slots  -> offer 2-3 best options
        |
  [Patient picks]  -> create appointment (doctor_id, branch_id, slot, token no.)
        |
  [Notify]  SMS (BD gateway) + Email + WhatsApp msg + QR token + map link
        |
  [Reminder]  24h and 2h before; "reply 1 to confirm, 2 to cancel/reschedule"

  THINKING / RISKS
  - AI books and triages only. It never diagnoses. Wording: "suggested specialty".
  - Existing patient? Match by phone + OTP so history/reports link correctly.
  - Family booking for someone else: ask "who is the patient?" (profile per family member).
  - Double-booking: slot must be locked in DB transaction at confirm time.
  - Human fallback: any time patient says "talk to a person" -> receptionist inbox.
  - Real phone-call hotline is the HARDEST (telephony + Bangla live voice). Do last.
    WhatsApp voice notes give 80% of the value at 10% of the cost.

## 2. QUICK MOBILE APP - Phase B  (recommend PWA first)

  Option 1 PWA (React, installable)   -> reuse current code, 1 codebase, ship in weeks, push on Android
  Option 2 React Native / Flutter     -> store presence, better iOS push; do after PWA proves demand

  Patient app screens (keep to 5):
  [Home: big mic "বলুন কী সমস্যা"] -> [My Booking + QR] -> [Live Queue] -> [My Prescriptions] -> [Reports]

## 3. LIVE QUEUE - Phase B

  Receptionist marks "patient arrived" --\
  Doctor marks "in chamber / on break"  ---> SignalR (WebSocket) hub ---> Patient app
  Doctor clicks "Next"                  --/
        Patient sees:  Doctor: PRESENT | Now serving: #7 | You: #11 | Est. wait ~35 min
        Push at: "2 patients before you", "Your turn - go to Room 302"

  THINKING: estimated wait = rolling average consult time of THIS doctor today.
  Handle no-shows (skip after N minutes), emergencies/walk-ins (insert with reason).

## 4. CONSULTATION + RECORDING - Phase C

  [Patient enters room]
        |
  [Consent screen/verbal: "this visit is recorded"]  <-- LEGALLY REQUIRED, log consent in DB
        |
  Doctor taps START  -> mic -> ambient scribe (already built)
        |
        +--> live transcript --> AI extracts: complaints, vitals, diagnosis, meds, advice
        |
  Doctor taps END -> audio finalized

  STORAGE-FRIENDLY RECORDING
  - Record as Opus @ 16-24 kbps mono  => ~7-11 MB per HOUR (a 10-min visit ~1.5 MB)
  - Store transcript text forever (tiny); keep audio 12-24 months, then archive/delete
  - Optional: AI "key advice clips" (30-60s) cut from the audio -> what patient replays
  - Store in object storage (S3/MinIO), DB keeps only the path + checksum
  - Encrypt at rest; access = doctor + that patient only; every play is audit-logged

  THINKING: The patient replay should be the SHORT advice summary (text + clip),
  not the whole 15-min recording. Full recording stays doctor-side by default.

## 5. PRESCRIPTION - FULL CRUD  (mostly DONE)

  AI draft  ->  Doctor OR Assistant edits  (voice command  OR  manual click/type)
        |
  Every field: add / edit / delete  (diagnosis, complaints, tests, meds, dose, duration,
  meal timing, advice, follow-up, referral)
        |
  [DDI + allergy check]  -> warning banner
        |
  [Doctor SIGNS / finalizes]  -> locked version (edits after = new version, audit log)
        |
  Print A4  +  send to patient app/WhatsApp  +  (optional) pharmacy QR

  TO ADD: assistant role (can edit draft, only doctor can finalize), version history,
  "who changed what" audit trail.

## 6. AFTER THE VISIT - Phase C/D

  A) MEDICINE GUIDE  (per medicine in app)
     - what it is for, how to take, common side effects, warnings (Bangla + English)
     - ALTERNATIVES if unavailable: same GENERIC + same strength + same form from our
       15K DB, sorted by price/availability. Show "ask your doctor/pharmacist before switching"
     - Source: DGDA data in DB (deterministic). LLM only rewrites into simple Bangla.
       Never let LLM invent alternatives.

  B) REMINDERS (opt-in)
     Prescription finalized -> "Turn on medicine reminders?"  [Yes / No]
        Yes -> schedule from dosage pattern (1+0+1 => morning/night), push + SMS fallback
        also: follow-up date reminder, "bring your CBC report"

  C) REPORT UPLOAD -> AI DATA ENTRY
     Patient uploads photo/PDF
        -> OCR + LLM extract (test name, value, unit, date, lab)
        -> shown to patient as DRAFT: "Is this correct?"  [Confirm / Fix]
        -> stored as structured lab results + original image
        -> next visit: doctor sees trend table (HbA1c, Creatinine...) automatically
     THINKING: confidence flag on each value; low confidence = highlighted for human check.
     Doctor sees "patient-reported/AI-extracted" label until verified.

  D) REPLAY ADVICE
     Patient app -> past visit -> [Play doctor's advice clip] + text summary in Bangla

## 7. DATA MODEL ADDITIONS (on top of current schema)

  patients (+phone OTP login, family_members)   branches   specialties   doctor_branches(schedule)
  appointments (+source: web/whatsapp/app/phone, status, token_no, slot)
  notifications (channel, status, sent_at)       consents (type, ts, who)
  visit_recordings (path, duration, retention_until)   visit_summaries (advice text, clip ref)
  prescription_versions (+audit)                 medicine_reminders (opt-in, schedule)
  lab_results (test, value, unit, date, verified_by, source_file)   users/roles (RBAC)

## 8. SECURITY / LEGAL (do not skip - health data)

  - RBAC + JWT (Phase 2 already planned) comes BEFORE any patient-facing app.
  - Patient identity: phone OTP. Rate-limit the public AI endpoints (cost + abuse).
  - Consent for recording + for reminders + for report storage, all logged.
  - Check Bangladesh data-protection rules and BMDC guidance on recordings/telemedicine.
  - WhatsApp: needs WhatsApp Business API (Meta-approved templates). SMS: local gateway
    (e.g. SSL Wireless / BulkSMSBD) with sender-ID registration. Both take days-weeks to approve
    -> START THE APPLICATIONS EARLY.
  - Keep a human-override everywhere (consistent with "AI is assistant, doctor is authority").

## 9. SUGGESTED BUILD ORDER

  P1  RBAC + branches/specialties/doctor schedules tables        (foundation)
  P2  Booking AI on website chat (text+voice) + SMS/email confirm + queue "token"
  P3  Patient PWA: login, booking, QR, LIVE QUEUE
  P4  WhatsApp channel for same booking AI (reuse P2 brain)
  P5  Recording + consent + advice summary/replay
  P6  Medicine guide + alternatives + opt-in reminders
  P7  Report upload + OCR + lab trends
  P8  Phone hotline (telephony + live Bangla voice)   <- last, most expensive
  P9  Native app wrappers / store release

  Each phase ships something usable on its own. Existing doctor-side app keeps working.

## 10. OPEN DECISIONS (need your call)

  1. Booking channel first: website chat or WhatsApp?
  2. PWA first, or straight to native app?
  3. Who is the first pilot: your own clinic/chamber, or a partner hospital?
  4. Recording: full audio visible to patient, or only advice clip + summary?
  5. Budget guard for LLM/STT/SMS costs per booking.
