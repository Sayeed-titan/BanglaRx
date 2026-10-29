# BanglaRx design system (v0.2)

Visual source of truth: https://claude.ai/artifact/246uoQbyc5rEyYX7eZGjW2 (the Foundations sheet and 28 designed screens).
Code source of truth: `tokens.css` in this folder. Live gallery: run the frontend and open the app URL with `?ds` on the end.

## How the app stays in sync with the design

```
tokens.css  ──►  components (Button, Card, Modal ...)  ──►  every screen
     └────────►  legacy.css (old --slate-*, --teal-* names point at the tokens)  ──►  screens not migrated yet
```

- **One place to change a colour, size, radius or font: `tokens.css`.** Components, old class names (`btn-clinical`...) and old palette names all read from it, so the whole app follows, light and dark.
- **Changing the design = three steps, in this order**
  1. Update the Foundations sheet on the design canvas (so people can see the intent).
  2. Edit `tokens.css` (and the component or its CSS if the change is structural).
  3. Run `npm run check:ds`. It fails if contrast, tap size or text size would break. Then look at `?ds`.
- The canvas is not wired to the code automatically. Step 2 is a deliberate edit, and step 3 is what makes it safe.

## Rules for every screen

1. Build with the components in `index.ts`. Do not hand-style buttons, fields, badges, cards or dialogs.
2. No hard-coded colours (`#fff`, `rgba(...)`). Use `--rx-*` variables. Never use the old `--slate-*`, `--teal-*`, `--crimson-*`, `--amber-*`, `--emerald-*`, `--sapphire-*` names in new code.
3. Smallest text is 13px (`0.8125rem`). Tap targets are 44px or more. Never remove a focus ring (`outline: none`).
4. Status colour always comes with a word or icon (`Badge`, `Callout`).
5. Missing clinical data reads `Not recorded` (`VitalRow`, `PatientBanner`). Never show a zero or a guess.
6. The AI drafts, people decide: every AI-filled field stays editable.
7. Icon-only buttons need an `aria-label` (`IconButton` enforces it). Dialogs use `Modal` (Esc, focus trap, focus return).
8. The prescription sheet (`.rx-paper`) is always light, on screen and in print. Do not put dark styles on it.
9. Check both themes (moon button in the app bar) and the A+ text switch before you call a screen done.

## The guard: `npm run check:ds`

Runs automatically before `npm run build`. It checks:

| Check | Fails when |
| --- | --- |
| Contrast | any text/background token pair drops below 4.5:1 in light or dark |
| Sizes | tap target below 44px, text token below 13px, body below 16px |
| Print | the dark theme is not inside `@media not print` |
| Screens | a file gets MORE hard-coded colours, tiny fonts, old palette names, old classes or removed focus rings than recorded in `baseline.json` |
| Gallery | a component is exported but not shown in `Preview.tsx` |

Files inside `design-system/` must have zero violations. Existing screens may have old styling (recorded in `baseline.json`) but it can only go down. After you migrate a screen, run `npm run check:ds -- --update` to lock in the progress.

## What exists

| File | Components |
| --- | --- |
| `actions.tsx` | Button, IconButton, Chip, Switch, SegmentedControl |
| `display.tsx` | Badge, Callout, Card, StatTile, Avatar, TokenBadge |
| `fields.tsx` | TextField (label, helper, error, unit suffix) |
| `layout.tsx` | AppBar, EmptyState, Select, Textarea |
| `overlay.tsx` | Modal (centred dialog or side drawer) |
| `voice.tsx` | MicPod, Equalizer |
| `queue.tsx` | QueueCard |
| `chat.tsx` | MessageBubble, TypingDots, Composer |
| `clinical.tsx` | VitalRow, PatientBanner, MedicineRow |
| `prefs.ts` | usePrefs, initPrefs (dark mode and A+ text, remembered per browser) |

Add a component in the matching file, export it from `index.ts`, show it in `Preview.tsx`, then run the guard.

## Pages (the canvas structure, in code)

| Route | Page | Built from |
| --- | --- | --- |
| `#/` | Workbench: app bar, patient card and voice on the left, the prescription sheet on the right | `components/Navbar`, `PatientCard`, `VoiceConsultation`, `AccuracyAnalytics`, `PrescriptionPad`, `MedicineSearch` |
| `#/queue` | Today's chamber queue: stat tiles, call next, list, "what patients see" | `pages/QueuePage` |
| `#/register` | New patient and token: three steps, sticky token card | `pages/RegistrationPage` |
| `#/dashboard` | Manager overview: counts, arrivals by hour, doctors right now. Read-only, counted from the real queue and prescriptions | `pages/DashboardPage` |
| `#/login`, `#/password`, `#/users` | Sign-in, setup, change password, and the manager's user list. Shown by `auth/AuthGate` around the whole app; roles decide which screens open (`auth/roles.ts`), the server decides what is allowed | `pages/LoginPage`, `pages/UsersPage`, `auth/` |
| `#/bookings` | The booking desk: pick a doctor and a day, see every time, book, move, cancel, mark arrived (becomes a queue token). Doctors and assistants see their own day read-only | `pages/BookingsPage` |
| `#/schedules` | Doctors, branches and weekly sessions. Reads and saves through the API (`/api/schedules`), validated on the server | `pages/SchedulesPage` |
| `#/patient` | The patient app: phone-code sign-in, family, today's place in line, book and cancel. Bangla first, English toggle, `Rx density="patient"`. Outside the staff gate; uses its own token (`patient/session.ts`) | `patient/PatientApp` |
| `#/pharmacy` | Find a signed prescription by Rx number and tick medicines off. Shows no diagnosis or notes. Ticks are not saved yet | `pages/PharmacyPage` |

Routing is a plain hash route in `App.tsx`. All state and handlers still live in `App.tsx`, so every function works across pages. Page layout classes are in `pages.css`; the prescription sheet is in `pad.css` and is sized in `em` so the screen (14px) and A4 print (9.5pt) stay in proportion. Keep `.rx-paper`, `no-print` and `main > section:last-child` intact: `index.css` print rules depend on them.

## Migration status

Every screen now uses the design components and the page structure from the canvas. The guard's legacy count is 6, all inside `index.css` (the print stylesheet keeps its own colours on purpose).

Not built yet (designed on the canvas): NavRail, BottomNav, Sheet, DdiAlert, AuditTrail, QueueTrack, ConsentSheet, Toast, Skeleton, and the canvas pages that need backend features that do not exist yet: sign-in and roles (RBAC), Rubina inbox and booking, dispense records, and the patient app. See `FULLSTACK_WORKFLOW.md` at the repo root: each of these is built as a slice, database + API + tests + screen together. Build their tables and endpoints first, then the screens, so no page shows invented data.
