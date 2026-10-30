# TODO now

Details for every line: [GAP_ANALYSIS.md](GAP_ANALYSIS.md). Test results: [ROLE_CHECK.md](ROLE_CHECK.md).

## P0 (before any real patient data)
- [x] `init_database.sql` now refuses to run on a database that holds data; runbook updated
- [x] Remove committed DB password `123456`; fail start-up if no connection string
- [x] Turn auth on by default
- [x] Untrack `BanglaRx.Api/.vs/` files from git
- [x] Send Gemini key in a header, not the URL
- [ ] Decide: patient data to Gemini, consent and data location (your call)

## Follow-ups from the P0 work
- [ ] Rotate the old database password `123456` (it is still in git history) and use the `banglarx_app` user
- [ ] Review and clean 6 test leftovers in the real `BanglaRxDB` (see ROLE_CHECK.md, "Incident")
- [ ] Decide whether to rewrite git history to remove the old password

## P1 (before a pilot clinic)
- [ ] Add CI (build, tests, lint, `tsc`)
- [ ] Fix the 2 `tsc` errors, add `tsc -b` to the build
- [ ] Stop screens calling APIs the role cannot read (403 noise)
- [ ] Add an error boundary around each screen
- [ ] Log who reads a patient record
- [ ] Rate limits, security headers, global error handler
- [ ] Check: can a doctor read another doctor's booking by id?
- [ ] Setup endpoint needs a one-time token on a public server
- [ ] Load the real medicine list (63 rows now, docs say 15,000)
- [ ] Record source and reviewer for each drug-interaction rule
- [ ] Add versioned DB migrations
- [ ] Off-box backups and a restore drill
- [ ] Shorter patient token life or cookie storage
- [x] Check why `/api/status` shows the wrong database name

## P2 (next)
- [ ] Real SMS provider
- [ ] Pick a voice provider after measuring accuracy
- [ ] Wait time estimate and "2 away" alert
- [ ] Pharmacy stock
- [ ] Branches and nearest-branch search
- [ ] Split `App.tsx` and `PatientApp.tsx`
- [ ] Real URLs instead of `#/`
- [ ] Update `README.md`, `TODO.md`, `MASTER_AGREEMENTS.md` (out of date)
- [ ] Merge or delete old branches
- [ ] Save doctor drafts offline

## Done
- [x] Full-cycle role test (`tests/run-fullcycle-tests.mjs`, 11 pass)
- [x] All backend suites pass (139 tests)
- [x] Gap analysis written
