# Full-cycle role check (2026-10-30)

Run against throw-away databases only. The real `BanglaRxDB` was never touched.

## Result

| Check | Result |
|---|---|
| API suites: api 20, auth 55, booking 36, patient 27, pharmacy 1 | 139 pass, 0 fail |
| **New** `tests/run-fullcycle-tests.mjs` (one clinic day, every role) | 11 pass, 0 fail |
| Frontend production build | passes |
| `tsc -b` | 2 errors in `App.tsx` (unused `React`, `setAiMeta`), known, build does not run `tsc` |
| Browser walk, 5 roles x all 9 internal screens | sidebar and redirects correct for every role |
| AI dictation (Gemini) | **not run**: needs an API key. Use `node tests/run-dictation-tests.mjs` with a key set |

## The full cycle that is now tested end to end (`run-fullcycle-tests.mjs`)

1. Manager does first-time setup (a second setup is refused), creates receptionist, 2 doctors, assistant, pharmacist.
2. Manager gives doctor 1 a Monday session open to online booking.
3. Patient signs in by phone code, adds themself, answers the consent question.
4. Patient finds doctor 1 (doctor 2 has no schedule, so is not offered) and books a slot.
5. Receptionist sees the booking, checks the patient in. The token lands in doctor 1's queue only; doctor 2 never sees it. Patient sees their place in line.
6. Doctor 1 reads consent, writes the prescription. Doctor 2, reception and the assistant are all refused when they try to write or edit it.
7. Assistant reads their own doctor's queue and prescription, and is refused doctor 2's.
8. Pharmacist sees the prescription **without the diagnosis**, records the hand-over; has no queue or patient list.
9. Patient sees the signed prescription with other brands of the same ingredient.
10. Role matrix: 17 door checks (who may open what) plus 5 "no sign-in" checks.
11. Sign-out ends the session at once; a disabled account is cut off at once.

## Browser walk (real sign-in form for the manager; other roles signed in through the API)

| Role | Sidebar shows | Blocked screens |
|---|---|---|
| Manager | all 9 | none |
| Receptionist | Queue, New patient, Bookings, Rubina inbox | others fall back to Queue |
| Doctor | Workbench, Queue, New patient, Bookings | others fall back to Workbench |
| Pharmacist | Pharmacy only | others fall back to Pharmacy |
| Assistant | not walked in the browser (covered by the API test above) | |

## Problems found

1. **Screens ask for data the role may not read.** Signed in as pharmacist, the app calls `/api/patients`, `/api/queue`, `/api/templates` and gets 403 on every page load (dozens of red console errors). A receptionist gets 403 on `/api/templates`. Nothing breaks on screen and nothing leaks, but it is wasted calls and noisy logs. Cause: the data loading in `frontend/src/App.tsx` does not check the role first.
2. **`GET /api/status` reports `databaseName: BanglaRxDB` on the test stack**, which runs on a different database. The name looks hard-coded, so the status page can mislead. Check `StatusEndpoints.cs`.
3. `tsc` errors (above).

## Not covered (be honest)

- The Gemini-backed screens: consultation dictation, Rubina chat answers, report photo reading.
- Printing the A4 prescription.
- A real phone, real SMS, and the IIS deployment.
- Assistant role in the browser.

## Re-run

```bash
for s in api auth booking patient pharmacy fullcycle; do node tests/run-$s-tests.mjs; done
```
