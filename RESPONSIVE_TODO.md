# 📱 BanglaRx AI™ — Responsive Design & Mobile/Tablet Architecture TODO

> **Status:** Post-Core Development Roadmap  
> **Target Devices:** Smartphones (iOS & Android, 360px–480px), Tablets (iPad Air/Pro, Galaxy Tab, 768px–1024px), Desktop Kiosks (1200px+)  
> **Priority:** Scheduled immediately following basic clinical development sign-off.

---

## 📋 Master TODO Checklist

### Phase 1: CSS Breakpoints & Fluid Token Architecture
- [ ] **Define Responsive Breakpoints in `frontend/src/styles/design-tokens.css`:**
  - `--bp-mobile: 480px;`
  - `--bp-tablet-portrait: 768px;`
  - `--bp-tablet-landscape: 1024px;`
  - `--bp-desktop: 1280px;`
- [ ] **Touch Target Standards:** Add `.btn-touch` with `min-height: 44px; min-width: 44px;` (WCAG 2.1 compliance).
- [ ] **Prevent iOS Input Auto-Zoom:** Set `font-size: 16px;` on mobile inputs (`@media (max-width: 768px)`).
- [ ] **Fluid Typography System:** Implement `clamp()` for headings across viewports.
- [ ] **Safe Area Insets:** Support iPhone notch/home indicator via `padding-bottom: env(safe-area-inset-bottom);`.

---

### Phase 2: Navigation Bar & Chamber Header Optimization
- [ ] **Mobile Header Redesign (`Navbar.tsx`):**
  - Single-row mobile header with compact logo and touch icons.
  - Mobile action sheet / drawer for secondary actions (`Chamber Setup`, `Architecture`).
  - Prominent touch pills for `📋 Queue` and `+ New Patient`.
- [ ] **Compact Physician Profile Pill:** Truncate doctor credentials on mobile with tap-to-expand popover.

---

> **Update:** the workbench tab switcher (Consultation / Rx) below 900 px, 16 px inputs on phones and the installable app (manifest, service worker, icons) are done. The rest of this list is mostly covered by the redesign; re-check each item on a real phone.

### Phase 3: Adaptive Workspace Layout & Mobile Tabbed Switcher
- [ ] **Replace Hardcoded Grid Columns in `App.tsx`:**
  - Change `gridTemplateColumns: '43% 57%'` to responsive `.clinical-workspace-grid`.
- [ ] **Segmented Tab Switcher for Tablets & Smartphones (`< 1024px`):**
  - Tab 1: `🎙️ Consultation & Scribe`
  - Tab 2: `📋 Prescription Pad (Rx)`
  - Automatic tab switch when doctor clicks *"Generate Prescription"*.
  - Floating badge showing active medicine count (e.g. `Rx (3)`).

---

### Phase 4: Institutional Prescription Pad Refactor
- [ ] **Responsive Clinical Layout (`PrescriptionPad.tsx`):**
  - Replace `gridTemplateColumns: '270px 1fr'` with stacked mobile sequence:
    $$\text{Vitals} \longrightarrow \text{Complaints} \longrightarrow \text{Diagnosis} \longrightarrow \text{Medicines} \longrightarrow \text{Advised Tests} \longrightarrow \text{Advice} \longrightarrow \text{Follow-up}$$
- [ ] **Responsive Patient Demographics Bar:**
  - Transition from 5 fixed columns to fluid auto-fit wrap (`repeat(auto-fit, minmax(130px, 1fr))`).
- [ ] **Touch-Optimized Medicine Row Controls:**
  - Stack Dosage, Duration, and Bengali Meal Instructions gracefully with full-width touch selectors on mobile.
- [ ] **Advised Tests Touch Chips:**
  - Enlarge test addition chips (`+ CBC`, `+ Dengue NS1`, `+ Serum Creatinine`) for easy thumb tapping.

---

### Phase 5: Voice Consultation & Ambient Pod Touch Tuning
- [ ] **Microphone Pod (`VoiceConsultation.tsx`):**
  - 68px $\times$ 68px touch-optimized recording button with active spring feedback.
  - Horizontally scrollable quick-preset chips on mobile (`overflow-x: auto; -webkit-overflow-scrolling: touch;`).
- [ ] **Voice Amendment Mode:**
  - Stack voice edit toggle buttons vertically on narrow viewports (`< 420px`).

---

### Phase 6: Modals, Drawers & Bottom-Sheet Behavior
- [ ] **Mobile Bottom Sheets:**
  - Transform desktop modals (`PatientRegistrationModal`, `DoctorProfileModal`, `PatientQrModal`) into iOS-style bottom sheets with grabber handles on screens `< 768px`.
- [ ] **Chamber Queue Drawer (`ChamberQueueDrawer.tsx`):**
  - Expand drawer to 100% width on phones.
  - Large tap-to-dismiss and swipe dismissal support.
- [ ] **Triage Vitals Input Grid:**
  - Convert 4-column vitals input on mobile registration forms to a clean 2x2 grid.

---

### Phase 7: Real-Device Testing & Verification Checklist
- [ ] Chrome DevTools Device Mode: iPhone 14/15 Pro, Samsung Galaxy S22/S23, iPad Mini, iPad Pro 11"/12.9".
- [ ] Verify zero horizontal page scrolling (`overflow-x: hidden`).
- [ ] Verify `@media print` formatting preserves official A4/A5 medical stationery regardless of originating device.
