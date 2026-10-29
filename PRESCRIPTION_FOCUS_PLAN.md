# Focus Plan: Doctor Prescription - Super Easy + Accurate

Everything else in PRODUCT_FLOW_PLAN.md is parked. This is the only active track.

## A. GAPS FOUND IN CURRENT CODE (evidence)

| # | Gap | Where | Why it matters |
|---|-----|-------|----------------|
| 1 | AI fills FAKE defaults when it returns nothing: vitals 120/80/98.6/76, "CBC with ESR", generic advice, 7-day follow-up, "fever >103" red flag | ConsultationAiService.cs:319-326 | Breaks our own "no synthetic data" rule; doctor may sign invented content |
| 2 | Confidence score hard-coded 0.98 | ConsultationAiService.cs:327 | Fake number, gives false trust |
| 3 | Patient allergies, age, weight, chronic conditions are NEVER sent to the AI or checked | ConsultationAiService.cs (no use), DB has them | Allergy to Penicillin + Amoxicillin prescribed = no warning |
| 4 | DDI match uses substring Contains | DrugSafetyService.cs:43 | False alarms ("alarm fatigue") and possible misses; no duplicate-generic check |
| 5 | Medicine grounding picks first brand that StartsWith first word; strength/form then OVERWRITTEN from DB match | ConsultationAiService.cs:261-285 | "Napa" vs "Napa Extra", wrong strength silently written |
| 6 | Bangla->brand transliteration is a hard-coded list of 14 | ConsultationAiService.cs:60-76 | Most spoken Bangla brand names miss the candidate pool |
| 7 | Save API has NO follow-up, referral, G/E signs, O/E, red flags fields | RequestsAndResponses.cs:29-41, PrescriptionEndpoints.cs:72-85 | Doctor edits those on the pad, they are lost on save/reopen |
| 8 | No edit-after-save (only POST). Rx number is random 4 digits; always is_signed=true | PrescriptionEndpoints.cs:60-145 | Collisions possible; no versions; no draft state |
| 9 | No dose-vs-age/weight check (esp. children) | none | Accuracy/safety |
| 10 | No "repeat last Rx" / templates / favourites | none | Biggest speed win for follow-up patients |

## B. FLOW WE WANT (doctor's view)

  Patient selected from queue
        |
  Pad opens PRE-FILLED: triage vitals + G/E + allergies + chronic + LAST visit summary
        |
  Doctor speaks / types (voice OR keyboard, both always work)
        |
  AI draft  -- only what was actually said; blanks stay BLANK (never invented)
        |
  SAFETY STRIP (always visible, colour coded)
    [Allergy]  [Duplicate generic]  [Interaction]  [Dose-for-age/weight]  [Not in formulary]
        |
  Doctor fixes anything in 1 click (type-ahead for medicine, dosage chips)
        |
  [Sign]  -> saved as FINAL version  -> Print A4
        |
  Later edit -> new version, old kept (audit)

## C. BUILD ORDER (quickest value first)

  Step 1  TRUTHFULNESS (small, do first)
          - Remove all fake defaults (#1, #2). Empty stays empty; UI shows "Not recorded/Not advised".
          - Show real per-medicine match status: Exact / Fuzzy-check-me / Not found (replaces 0.98).

  Step 2  FULL SAVE (fixes data loss #7, #8)
          - Add columns + DTO: follow_up, referred_to, general_signs, on_exam_notes, red_flags, status(draft/final), version.
          - POST draft, PUT update, sign = final. Sequential Rx number from DB sequence.
          - Re-open a saved Rx on the pad with everything restored.

  Step 3  SAFETY ENGINE (fixes #3, #4, #9)
          - Send allergies/age/weight/chronic to the AI prompt as context.
          - Deterministic checks in C# (not LLM): allergy class match, duplicate generic,
            exact-generic DDI (no substring), basic max-dose for children by weight.
          - Result shown in the safety strip; doctor can override with a reason (logged).

  Step 4  MEDICINE ACCURACY (fixes #5, #6)
          - Candidate search from DB aliases table (Bangla spelling + brand) instead of 14 hard-codes.
          - Match on brand + strength + form; if ambiguous, show a 2-3 option chooser, don't guess.

  Step 5  SPEED FOR DOCTOR (#10)
          - "Copy last prescription" for follow-ups.
          - Doctor's own favourite sets (e.g. "Viral fever", "UTI") one click -> fills meds+advice.
          - Keyboard shortcuts: / search medicine, Enter add, Ctrl+S sign, Ctrl+P print.
          - Assistant role: can draft/edit, only doctor signs (small, before RBAC).

  Step 6  PROVE IT
          - Test set of ~30 real-style Bangla/Banglish dictations with expected output.
          - Measure: medicine correct %, dose correct %, time-to-sign. Re-run after each change.

## STATUS (updated 2026-10-30)

- [x] Step 1 Truthfulness: fake defaults removed (AI, pad, triage form, patient API); real match badge instead of 0.98
- [x] Step 2 Full save: all pad fields saved; PUT edit with version + audit; DB-sequence Rx numbers; Dapper snake_case mapping fixed (reopen returned blank brand/dose before)
- [x] Step 3 Safety engine: allergy (class-aware), duplicate ingredient, exact-ingredient DDI (salt-aware), dose ceiling + child mg/kg; `POST /api/safety/check`; red/amber strip on pad (screen only)
- [x] Step 4 Medicine accuracy: strength-aware resolver (exact / ambiguous / strength_unavailable / fuzzy / unmatched) with 1-click chooser; Bangla spellings in `medicine_aliases` table
- [x] Step 5 Speed: Repeat last Rx, per-doctor templates, Ctrl+S save, "/" focuses medicine search
- [x] Step 6 Proof: 30 dictation cases in `tests/`, run `node tests/run-dictation-tests.mjs` (results in `tests/last-results.json`). Run 1: medicines 97%, dosage 100%, 0 invented fields, median 9s. Found + fixed: AI silently dropped medicines not in the formulary (now kept and flagged). Re-run of the 3 failed cases: all pass. Known flaky: neg-3 ("just reassure") sometimes adds a reassurance advice line.

Known gaps / next:
- [x] Manual "add medicine" no longer defaults duration/instructions (shows "— choose —"); save asks to confirm if dosage/duration missing.
- AI call takes ~15s on the current Gemini tier (target <10s): upgrade tier / faster model.
- Allergy classes list is a starter set; extend when the full 15K formulary is loaded.
- No UI yet to browse and reopen old prescriptions; no assistant-vs-doctor sign-off role.

## D. DONE WHEN
  - Doctor sees a safe, correct draft in <10s after speaking and signs in <60s total.
  - Zero invented fields. Nothing the doctor edited is lost on save/reopen.
  - Allergy / duplicate / interaction warnings fire correctly on the test set.
