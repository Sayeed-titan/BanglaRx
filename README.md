# BanglaRx AI™ — Ambient Clinical & Prescription Guardian
*Built for the DCCI AI Innovation Fair (BICC / Chin Moitri Sommelon Kendro, Dhaka)*

---

## 1. Project Overview & Folder Structure

```text
d:\Departmental\R&D - MKL\BanglaRx\
├── database/
│   └── init_database.sql       <-- SINGLE MASTER SCRIPT (ALL DDL + SEED DATA)
├── BanglaRx.Api/               <-- ASP.NET Core (.NET 8) Web API
│   ├── Program.cs              <-- Endpoints, AI Parser, DDI rules, Dapper/Npgsql
│   ├── appsettings.json        <-- PostgreSQL connection string
│   └── BanglaRx.Api.csproj
├── frontend/                   <-- React + Vite + Lucide + QRCode
│   ├── src/
│   │   ├── App.tsx             <-- Split-Screen Doctor Chamber Dashboard
│   │   └── index.css           <-- Styling, badges, print stylesheet
│   └── package.json
├── start_banglarx.bat          <-- 1-Click Launch Script for Fair Stall
└── README.md
```

---

## 2. Database Script (Single SQL File)
As requested, all table definitions, indexes, relations, and initial seed data are kept in a single self-contained, idempotent SQL file:
📁 **`d:\Departmental\R&D - MKL\BanglaRx\database\init_database.sql`**

### What it creates and seeds in `BanglaRxDB`:
1. **`medicines`**: 63 top Bangladeshi pharmaceuticals (Square, Beximco, Incepta, Renata, Opsonin) with brand names, generics, strengths, and standard Bengali instructions (`ভরা পেটে খাবেন`, `খাওয়ার ২০ মিনিট আগে`).
2. **`drug_interactions`**: Critical Drug-Drug Interaction rules (e.g. *Ciprofloxacin + Antacid*, *Aspirin + Warfarin*, *Clopidogrel + Omeprazole*).
3. **`doctors`**: Physician profiles (BMDC registration, degrees, hospital affiliations).
4. **`patients`**: Patient health records, chronic history, allergies, and blood groups.
5. **`prescriptions` & `prescription_items`**: Completed electronic prescriptions.
6. **`audit_logs`**: System audit events.

---

## 3. How to Run the Project

### Option A: The 1-Click Launcher (Recommended for the Fair)
Double-click:
📁 **`d:\Departmental\R&D - MKL\BanglaRx\start_banglarx.bat`**

This will automatically:
1. Boot the **ASP.NET Core Web API** on `http://localhost:5000`
2. Boot the **Vite React Frontend** on `http://localhost:5173`
3. Launch your browser directly to the dashboard.

### Option B: Manual Terminal Execution
* **Backend:**
  ```powershell
  cd "d:\Departmental\R&D - MKL\BanglaRx\BanglaRx.Api"
  dotnet run
  ```
* **Frontend:**
  ```powershell
  cd "d:\Departmental\R&D - MKL\BanglaRx\frontend"
  node "node_modules/vite/bin/vite.js" --port 5173
  ```

---

## 4. Stall Showcase & Live Demonstration Guide

When visitors, doctors, or judges come to your stall:

1. **The Hero Voice Demo:**
   - Click the big **"Start Consultation"** microphone button and speak a case (e.g., *"Patient has high fever 102F and acidity, prescribe Napa Extra and Seclo 20"*).
   - Or click **"🌡️ 1. Dengue & Acidity"** under the quick preset scenarios.
   - Click **"Auto-Generate Prescription (AI)"**.
   - Watch the right-hand hospital pad instantly populate with structured medicines, dosages, and Bengali advice in under 1 second.
2. **The Safety Guardian (DDI Alert):**
   - Click **"⚠️ 3. Drug Interaction Alert"**.
   - The AI identifies the patient is taking Warfarin and warns of severe hemorrhage when Aspirin is prescribed, highlighting the red alert card.
3. **The Mobile Patient Passport:**
   - Click **"Patient Mobile View"**.
   - A QR code modal pops up. Visitors scan it with their phone camera to see the patient view with a **"Listen in Bangla (অডিও শুনুন)"** audio button.
4. **Print / Export:**
   - Click **"Print Rx"** to preview the clean, official Bangladesh medical prescription pad layout.
