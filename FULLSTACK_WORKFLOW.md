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
node tests/run-api-tests.mjs            # API tests (about 10 seconds). Uses a throw-away database.
cd frontend && npm run check:ds         # design guard (also runs before every build)
cd frontend && npm run build
```

To try a screen against a throw-away back end instead of your real data:

```bash
node tests/start-test-stack.mjs                                   # own database + API on :5155
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

## Next slices (from PRODUCT_FLOW_PLAN.md)

1. Roles and sign-in (users, roles, JWT, guarded endpoints, login screen). Needs a decision on how existing endpoints get guarded without breaking the running app.
2. Booking: appointments get a source, slot and status; Rubina chat endpoint; reception inbox screen.
3. Dispense records: pharmacy ticks saved against a prescription.
4. Day filter on the queue (it currently lists every day).
