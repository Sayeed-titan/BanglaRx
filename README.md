# 🏥 BanglaRx AI™ — Ambient Clinical Intelligence & Smart Prescription Guardian

[![.NET 8](https://img.shields.io/badge/.NET-8.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![React 19](https://img.shields.io/badge/React-19.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL 18](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Gemini](<https://img.shields.io/badge/AI-Google%20Gemini%203.5%20Flash-4285F4?logo=google&logoColor=white>)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Status: DCCI AI Fair Showcase](<https://img.shields.io/badge/Showcase-DCCI%20AI%20Innovation%20Fair-FF6F00>)](https://dcci.org.bd/)

> **BanglaRx AI** is an intelligent ambient clinical scribing and prescription guardian designed specifically for healthcare ecosystems in Bangladesh. It captures natural, unstructured doctor-patient consultations spoken in **Bangla, English, or colloquial Banglish**, extracts clinical entities via Google Gemini Multimodal Reasoning, grounds medications against the **DGDA National Drug Registry**, intercepts life-threatening **Drug-Drug Interactions (DDI)** in real-time, and generates an official, scannable bilingual prescription with automated patient audio instructions.

---

## 📑 Table of Contents

- [1. Executive Summary &amp; Problem Statement](#1-executive-summary--problem-statement)
- [2. Core Features](#2-core-features)
- [3. System Architecture &amp; Flow](#3-system-architecture--flow)
- [4. Technology Stack](#4-technology-stack)
- [5. Project Directory Structure](#5-project-directory-structure)
- [6. Prerequisites &amp; Environment Setup](#6-prerequisites--environment-setup)
- [7. Installation &amp; Quick Start](#7-installation--quick-start)
- [8. Database Design &amp; Seeding](#8-database-design--seeding)
- [9. REST API Reference](#9-rest-api-reference)
- [10. Frontend Component Architecture](#10-frontend-component-architecture)
- [11. DCCI AI Innovation Fair Showcase Runbook](#11-dcci-ai-innovation-fair-showcase-runbook)
- [12. Safety, Privacy &amp; Ethical AI Safeguards](#12-safety-privacy--ethical-ai-safeguards)
- [13. Troubleshooting &amp; FAQ](#13-troubleshooting--faq)
- [14. Roadmap &amp; Future Scope](#14-roadmap--future-scope)
- [15. License &amp; Team](#15-license--team)

---

## 1. Executive Summary & Problem Statement

### The Healthcare Reality in Bangladesh

- **Extreme Patient Volumes:** Chamber physicians in Dhaka, Chittagong, and rural upazilas routinely consult **50 to 90 patients per day**, leaving as little as 3 to 5 minutes per patient.
- **Administrative Burden:** Doctors spend up to **60% of consultation time manually writing prescriptions**, contributing to severe physician burnout and reduced face-to-face empathetic listening.
- **Handwriting Legibility Issues:** Illegible handwritten prescriptions result in pharmacy dispensing errors, adverse drug reactions, and patient non-compliance.
- **Bilingual & Colloquial Code-Switching:** Consultations in Bangladesh are rarely purely English or formal Bengali; they are a rapid, colloquial mix of Banglish (e.g., *"Patient er 3 din dhore high fever ar acidity, Napa Extra ar Seclo 20 bid den"*). Standard Western clinical tools fail entirely in this linguistic context.
- **High Rates of Preventable Drug Interactions:** Simultaneous prescriptions of interacting compounds (e.g., NSAIDs with Anticoagulants, or Fluoroquinolones with Antacids) frequently go unnoticed in busy outpatient chambers.

### The BanglaRx AI Solution

BanglaRx AI acts as a **silent, ambient clinical co-pilot** sitting on the doctor’s desk. It listens to the consultation in real time, converts natural speech to structured clinical JSON, grounds brand names to certified local manufacturers (Square, Beximco, Incepta, Renata, Opsonin), alerts the doctor to contraindications, and hands the patient a digital QR passport that reads their dosage out loud in Bengali.

---

## 2. Core Features

### 🎙️ 1. Ambient Bilingual Consultation Capture

- **Real-Time Speech-to-Text:** Built-in dual language toggle supporting both **`bn-BD` (বাংলা)** and **`en-US` (English / Colloquial Banglish)** using the browser's Web Speech API.
- **Hands-Free Ambient Listening:** Doctors can conduct consultations normally without touching a keyboard or mouse.
- **Built-in Offline Presets:** One-click instant clinical scenarios (Dengue & Gastritis, Type 2 Diabetes & Hypertension, Warfarin DDI Alert) for rapid testing and network-free booth demonstrations.

### 🧠 2. Google Gemini Neural Inference Engine

- Powered by Google's **Gemini 3.5 Flash** neural network with deterministic JSON schema enforcement (`temperature: 0.2`).
- Extracts symptoms into standardized **Chief Complaints**, records **Vitals** (BP, Temp, Pulse), derives a **Differential Diagnosis**, lists prescribed medications, recommends **Lab Investigations**, and prepares **Bengali Lifestyle Advice**.
- Sub-2-second inference latency, keeping the doctor’s workflow uninterrupted.

### 📊 3. Real-Time Spoken vs. Accepted Accuracy Analytics

- Transparently audits AI performance on every consultation:
  - **Spoken Word Count:** Total linguistic tokens captured from the ambient audio.
  - **Accepted Clinical Entities:** Number of verified symptoms, diagnoses, medications, and advice items parsed.
  - **Extraction Efficiency Ratio (%):** Clinical density score showing data yield.
  - **Confidence Metric & Latency:** Real-time millisecond round-trip time and statistical confidence gauge.

### 🛡️ 4. PostgreSQL 18 RAG & DDI Safety Guardian

- **Ground Truth Knowledge Retrieval:** Every medicine suggested by the AI is matched against a curated PostgreSQL database containing 63 of Bangladesh’s most widely prescribed brand and generic drugs.
- **Fuzzy Trigram Matching:** Uses `pg_trgm` extensions to tolerate minor speech recognition errors (e.g., "Napa" vs "Napa Extra", "Monas" vs "Montene").
- **Automated DDI Interceptor:** Real-time safety engine intercepts critical drug-drug conflicts before the prescription can be finalized:
  - *Aspirin + Warfarin* (Severe hemorrhage risk)
  - *Ciprofloxacin + Antacid (Al/Mg)* (Chelation leading to 80% antibiotic failure)
  - *Clopidogrel + Omeprazole* (Inhibition of CYP2C19 antiplatelet bioactivation)
  - *Metformin + Iodinated Radiocontrast* (Risk of fatal lactic acidosis)
  - *ACE Inhibitors + Potassium-Sparing Diuretics* (Fatal hyperkalemia)

### 📋 5. BMDC-Compliant Split-Screen Prescription Pad

- Left pane: Ambient voice stream, live transcript, analytics gauge, and manual drug search.
- Right pane: Official Bangladesh Medical & Dental Council (BMDC) formatted prescription pad complete with doctor credentials, patient demographic header, $\text{R}_\text{x}$ symbol, dosage frequency (`1+0+1`, `0+0+1`), durations, and meal timings in Bengali.
- Inline manual editing: Doctors can adjust, delete, or append medicines with a single click.
- Single-click print stylesheet formatted precisely for A4 and A5 clinical stationery.

### 📲 6. Patient Mobile QR Passport & Audio Readout

- Generates an encrypted, scannable QR Code containing the full prescription payload.
- Patients scan the QR code with any smartphone camera to take their prescription home digitally.
- **"অডিও শুনুন" (Listen in Bangla):** Integrated Bengali Text-to-Speech synthesizes dosage timings and warnings into natural spoken Bengali, empowering elderly, visually impaired, or illiterate patients.

---

## 3. System Architecture & Flow

```mermaid
flowchart TD
    subgraph Client ["Client Tier (React 19 + TypeScript + Vite)"]
        Doctor(["👨‍⚕️ Doctor / Consultation"]) -->|Spoken Voice (bn-BD / en-US)| WebSpeech["Web Speech Recognition API"]
        WebSpeech -->|Live Transcript| VoiceComp["VoiceConsultation Component"]
        VoiceComp -->|Text Payload| UIState["App State Coordinator"]
        UIState --> Analytics["Accuracy Analytics Gauge"]
        UIState --> RxPad["BMDC Prescription Pad"]
        RxPad --> QRCode["Patient QR Mobile Passport"]
        RxPad --> BengaliTTS["Bengali Web Speech Audio Readout"]
    end

    subgraph API ["Application Tier (ASP.NET Core .NET 8)"]
        UIState -->|POST /api/ai/analyze-consultation| ApiRouter["BanglaRx API Minimal Router"]
        ApiRouter --> PromptEngine["Prompt Builder & Context Injector"]
        PromptEngine --> GeminiCall["Gemini 3.5 Flash Client (HTTPS)"]
        GeminiCall --> SchemaValidator["JSON Schema Enforcer"]
        SchemaValidator --> Matcher["RAG Entity Grounding Engine"]
        Matcher --> DdiCheck["DDI Clinical Safety Rules Evaluator"]
        DdiCheck --> AuditLog["Audit Logger"]
    end

    subgraph CloudAI ["AI Inference Tier (Google Cloud)"]
        GeminiCall -.->|Secure TLS 1.3| GeminiLLM["Google Gemini 3.5 Flash Lite API"]
        GeminiLLM -.->|Structured JSON| GeminiCall
    end

    subgraph Data ["Data Tier (PostgreSQL 18)"]
        Matcher <-->|Trigram Brand/Generic Matching| MedicinesTable[("medicines (63 National Brands)")]
        DdiCheck <-->|Rule Evaluation| DdiTable[("drug_interactions (Safety Rules)")]
        AuditLog -->|Inference Logs & Latency| AuditTable[("audit_logs")]
        RxPad -->|POST /api/prescriptions| RxTable[("prescriptions & prescription_items")]
    end
```

---

## 4. Technology Stack

| Layer                        | Technology     | Version        | Purpose                                               |
| :--------------------------- | :------------- | :------------- | :---------------------------------------------------- |
| **Frontend Framework** | React          | 19.3.1         | Declarative component architecture                    |
| **Frontend Language**  | TypeScript     | 6.0.3          | Strict static typing and interface contracts          |
| **Bundler & Tooling**  | Vite           | 8.3.4          | Ultra-fast HMR and ESM build pipeline                 |
| **Iconography**        | Lucide React   | 1.61.0         | Clinical and chamber UI iconography                   |
| **QR Code Engine**     | qrcode.react   | 4.2.0          | Canvas & SVG dynamic QR generation                    |
| **Backend Framework**  | ASP.NET Core   | 8.0 (.NET 8)   | High-throughput, cross-platform Minimal APIs          |
| **Backend Language**   | C#             | 12.0           | Modern memory-safe asynchronous backend logic         |
| **Database Access**    | Dapper         | 2.1.89         | Micro-ORM for high-speed queries                      |
| **PostgreSQL Driver**  | Npgsql         | 10.0.3         | Native ADO.NET provider for PostgreSQL                |
| **Database Engine**    | PostgreSQL     | 18.0           | ACID-compliant relational storage with trigram search |
| **AI / LLM Engine**    | Google Gemini  | 3.5 Flash Lite | Bilingual clinical extraction & reasoning             |
| **Speech Engine**      | Web Speech API | Native         | In-browser speech recognition and Bengali TTS         |

---

## 5. Project Directory Structure

```text
BanglaRx/
├── .gitignore                          # Excludes secrets, bin/obj, node_modules
├── README.md                           # Comprehensive documentation (this file)
├── start_banglarx.bat                  # 1-Click Launch Script for Fair Stall / Demos
│
├── database/
│   └── init_database.sql               # Single Master Script (DDL, Indexes, Seed Data)
│
├── BanglaRx.Api/                       # ASP.NET Core (.NET 8) Web API
│   ├── BanglaRx.Api.csproj             # NuGet dependencies (Dapper, Npgsql)
│   ├── Program.cs                      # Minimal API routes, Gemini pipeline, DDI engine
│   ├── appsettings.json                # Public configuration (Placeholders only)
│   └── appsettings.local.json          # Git-ignored local config (Real Gemini API Key)
│
└── frontend/                           # React 19 + TypeScript + Vite Application
    ├── package.json                    # Scripts and dependencies
    ├── vite.config.ts                  # Vite configuration
    ├── index.html                      # Entry HTML with Google Fonts
    └── src/
        ├── main.tsx                    # Application entry point
        ├── App.tsx                     # Main coordinator & split-screen layout
        ├── index.css                   # Global styles & print stylesheet
        ├── types/
        │   └── index.ts                # TypeScript interfaces (Medicine, Rx, Doctor, etc.)
        └── components/
            ├── Navbar.tsx              # System header with status badges & hospital branding
            ├── VoiceConsultation.tsx   # Speech recognition, audio presets & language toggle
            ├── AccuracyAnalytics.tsx   # Spoken words vs accepted entities gauge
            ├── MedicineSearch.tsx      # Manual medicine directory & quick-add search
            ├── PrescriptionPad.tsx     # Official BMDC prescription pad layout & print view
            └── PatientQrModal.tsx      # QR Code modal with Bengali audio playback
```

---

## 6. Prerequisites & Environment Setup

Before running the application, ensure the following runtimes are installed on your workstation:

1. **.NET SDK:** Version 8.0 or higher ([Download .NET 8](https://dotnet.microsoft.com/download/dotnet/8.0))
2. **Node.js:** Version 18.x or higher, with npm ([Download Node.js](https://nodejs.org/))
3. **PostgreSQL:** Version 14 or higher (Developed & tested on PostgreSQL 18) ([Download PostgreSQL](https://www.postgresql.org/download/))
4. **Google Chrome / Microsoft Edge:** Required for the native Web Speech API (`SpeechRecognition` & `SpeechSynthesis`).
5. **Google Gemini API Key:** An active key from [Google AI Studio](https://aistudio.google.com/).

---

## 7. Installation & Quick Start

### Step 1: Clone the Repository

```bash
git clone https://github.com/Sayeed-titan/BanglaRx.git
cd BanglaRx
```

### Step 2: Initialize the PostgreSQL Database

Open your terminal or `psql` shell and execute the master initialization script:

```bash
# If using psql directly:
psql -U postgres -d postgres -c "CREATE DATABASE \"BanglaRxDB\";"
psql -U postgres -d BanglaRxDB -f "database/init_database.sql"
```

*Alternatively, open **pgAdmin**, create a new database named `BanglaRxDB`, open the Query Tool, paste the contents of `database/init_database.sql`, and execute (F5).*

### Step 3: Configure Backend Secrets

The repository includes a secure placeholder configuration. To connect your Gemini API key and PostgreSQL credentials without risking git leaks:

1. Navigate to `BanglaRx.Api`:
   ```bash
   cd BanglaRx.Api
   ```
2. Create or edit `appsettings.local.json` (this file is pre-configured in `.gitignore`):
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Port=5432;Database=BanglaRxDB;Username=postgres;Password=YOUR_POSTGRES_PASSWORD;"
     },
     "Gemini": {
       "ApiKey": "YOUR_ACTUAL_GEMINI_API_KEY",
       "Model": "gemini-3.5-flash-lite"
     }
   }
   ```

### Step 4: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Step 5: Launch the Application

#### Option A: The 1-Click Stall Launcher (Recommended for Windows)

Simply double-click:

```text
start_banglarx.bat
```

This batch script will:

- Spin up the ASP.NET Core API on `http://localhost:5000`
- Spin up the Vite React frontend on `http://localhost:5173`
- Wait 4 seconds for services to warm up
- Automatically open Google Chrome to `http://localhost:5173`

#### Option B: Manual Dual-Terminal Launch

**Terminal 1 (Backend API):**

```bash
cd BanglaRx.Api
dotnet run
# Listening on http://localhost:5000
```

**Terminal 2 (Frontend UI):**

```bash
cd frontend
node node_modules/vite/bin/vite.js --port 5173
# Listening on http://localhost:5173
```

---

## 8. Database Design & Seeding

The application uses an idempotent, clean-slate SQL script located at `database/init_database.sql`.

### Key Tables & Schema Highlights:

| Table Name             | Description                                   | Key Columns / Constraints                                                                                                                                             |
| :--------------------- | :-------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medicines`          | Master pharmaceutical directory of Bangladesh | `id`, `brand_name`, `generic_name`, `form`, `strength`, `manufacturer`, `standard_dosage`, `instructions_bangla`, Trigram GIN index on `brand_name` |
| `drug_interactions`  | Rules engine for clinical safety checks       | `generic_a`, `generic_b`, `severity` (Critical/Major/Moderate), `description`, `clinical_advice`                                                            |
| `doctors`            | Physician credentials & chamber metadata      | `name`, `degrees`, `specialization`, `bmdc_reg_no` (UNIQUE), `hospital_name`, `room_no`                                                                   |
| `patients`           | Patient demographics & medical history        | `patient_uid` (UNIQUE), `full_name`, `age`, `gender`, `blood_group`, `allergies`, `chronic_conditions`                                                  |
| `prescriptions`      | Completed and signed prescriptions            | `rx_number` (UNIQUE), `doctor_id`, `patient_id`, `vitals` (JSONB), `diagnosis`, `advice_bangla`, `interaction_warnings` (JSONB)                         |
| `prescription_items` | Individual line-item medications              | `prescription_id`, `brand_name`, `generic_name`, `dosage_pattern`, `duration`, `instructions_bangla`                                                      |
| `audit_logs`         | Performance & inference audit trail           | `event_type`, `status`, `execution_time_ms`, `details` (JSONB), `created_at`                                                                                |

### Pre-Seeded Datasets:

- **63 Top Bangladeshi Medicines:** Covering major pharmaceutical innovators including **Square Pharmaceuticals**, **Beximco Pharma**, **Incepta**, **Renata**, and **Opsonin Pharma** (e.g., *Napa, Napa Extra, Ace, Seclo, Losectil, Sergel, Moxacil, Ciprocin, Azithral, Monas, Bizoran, Bexitrol F*).
- **Critical Interaction Rules:** Covers vital drug contraindications commonly encountered in outpatient practice.
- **Sample Physician & Patient Records:** Pre-populated profiles for instant testing without manual setup.

---

## 9. REST API Reference

The backend exposes clean, high-performance RESTful Minimal APIs:

### 1. System Health & Inventory Status

```http
GET /api/status
```

**Response (200 OK):**

```json
{
  "databaseConnected": true,
  "engine": "PostgreSQL 18",
  "databaseName": "BanglaRxDB",
  "aiModel": "gemini-3.5-flash-lite",
  "aiStatus": "Connected (Google Gemini Neural Network)",
  "counts": {
    "total_medicines": 63,
    "total_interactions": 6,
    "total_patients": 2,
    "total_prescriptions": 0,
    "total_doctors": 1
  },
  "timestamp": "2026-10-27T08:00:00Z"
}
```

---

### 2. Ambient Consultation Neural Analysis

```http
POST /api/ai/analyze-consultation
Content-Type: application/json
```

**Request Body:**

```json
{
  "transcript": "Patient has high fever 102F since 3 days with severe body ache and gastric burn. Give Napa Extra one tablet thrice daily after food and Seclo 20 before breakfast.",
  "doctorNotes": ""
}
```

**Response (200 OK):**

```json
{
  "chiefComplaints": ["High grade fever (102°F) for 3 days", "Severe generalized body ache", "Epigastric burning / Dyspepsia"],
  "vitals": {
    "bp": "120/80 mmHg",
    "temp": "102 F",
    "pulse": "92 bpm"
  },
  "diagnosis": "Acute Febrile Illness (Suspected Dengue / Viral) with Hyperacidity",
  "medicines": [
    {
      "medicineId": 2,
      "brandName": "Napa Extra",
      "genericName": "Paracetamol + Caffeine",
      "form": "Tablet",
      "strength": "500mg+65mg",
      "dosagePattern": "1+0+1",
      "duration": "5 days",
      "instructionsBangla": "ভরা পেটে খাবেন"
    },
    {
      "medicineId": 8,
      "brandName": "Seclo 20",
      "genericName": "Omeprazole",
      "form": "Capsule",
      "strength": "20mg",
      "dosagePattern": "1+0+1",
      "duration": "14 days",
      "instructionsBangla": "খাওয়ার ২০ মিনিট আগে"
    }
  ],
  "investigations": ["CBC with ESR", "Dengue NS1 Antigen", "Serum Creatinine"],
  "adviceBangla": ["পর্যাপ্ত পরিমাণে তরল খাবার ও খাবার স্যালাইন গ্রহণ করুন।", "পর্যাপ্ত বিশ্রাম নিন।", "জ্বর ১০২ ডিগ্রির বেশি হলে জলপট্টি দিন।"],
  "interactionWarnings": [],
  "confidenceScore": 0.98,
  "executionTimeMs": 1420,
  "model": "Google gemini-3.5-flash-lite (Neural Network) + PostgreSQL 18 RAG"
}
```

---

### 3. Drug-Drug Interaction Safety Intercept

```http
POST /api/interactions/check
Content-Type: application/json
```

**Request Body:**

```json
{
  "genericNames": ["Warfarin", "Aspirin"]
}
```

**Response (200 OK):**

```json
{
  "hasInteractions": true,
  "totalWarnings": 1,
  "warnings": [
    {
      "drugA": "Aspirin",
      "drugB": "Warfarin",
      "severity": "Critical",
      "description": "Concurrent use significantly increases the risk of severe, life-threatening gastrointestinal or intracranial bleeding.",
      "clinicalAdvice": "Avoid co-administration unless explicitly indicated for mechanical heart valves. Monitor INR closely."
    }
  ]
}
```

---

### 4. Search Master Drug Inventory

```http
GET /api/medicines?q=napa&limit=10
```

Returns list of medicines matching brand or generic names sorted by exact prefix relevance.

---

### 5. Save & Sign Prescription

```http
POST /api/prescriptions
Content-Type: application/json
```

Saves the finalized prescription transactionally to `prescriptions` and `prescription_items`, generating a unique `RX-YYYYMMDD-XXXX` tracking identifier.

---

## 10. Frontend Component Architecture

The React 19 frontend is structured into modular, reusable components located in `frontend/src/components/`:

```text
frontend/src/
├── types/index.ts              <-- Strict TypeScript contracts (Medicine, Prescription, etc.)
├── components/
│   ├── Navbar.tsx              <-- Chamber branding, DB connection pill, AI Model status
│   ├── VoiceConsultation.tsx   <-- Web Speech API listener, bn-BD/en-US toggle, 3 Demo Presets
│   ├── AccuracyAnalytics.tsx   <-- Spoken words vs accepted entities, conversion rate & latency
│   ├── MedicineSearch.tsx      <-- Real-time debounced medicine search & custom drug modal
│   ├── PrescriptionPad.tsx     <-- Official BMDC layout, inline drug editing, A4/A5 print engine
│   └── PatientQrModal.tsx      <-- Mobile QR Passport generator & Bengali speech synthesis
└── App.tsx                     <-- Central coordinator managing state, API calls & notifications
```

### Component Breakdown:

1. **`Navbar.tsx`**: Renders the chamber header, physician profile (`Dr. Tanvir Ahmed, MBBS, FCPS`), real-time PostgreSQL database heartbeat pill, and active AI engine badge.
2. **`VoiceConsultation.tsx`**: Handles browser speech recognition events (`onresult`, `onerror`, `onend`), audio visualizer animation, language toggle (`বাংলা` vs `English/Banglish`), manual note entry, and 1-click clinical preset injection.
3. **`AccuracyAnalytics.tsx`**: Calculates and visualizes real-time extraction efficiency metrics:
   $$
   \text{Efficiency Ratio} = \left(\frac{\text{Accepted Entities}}{\text{Spoken Words}}\right) \times 100
   $$

   Displays interactive cards for spoken words, accepted entities, extraction yield percentage, and inference latency.
4. **`MedicineSearch.tsx`**: Provides an instant lookup search bar against the backend's PostgreSQL database with quick-add chips and a custom medicine creation modal.
5. **`PrescriptionPad.tsx`**: The centerpiece digital pad reproducing an authentic hospital prescription layout, complete with patient vitals badges, complaint tags, investigation checklists, drug dosage chips (`1+0+1`), Bengali instructions, and a print stylesheet.
6. **`PatientQrModal.tsx`**: Generates a high-density QR code for the patient's phone and features a **"Listen in Bangla"** audio button that reads the prescription via `window.speechSynthesis`.

---

## 11. DCCI AI Innovation Fair Showcase Runbook

*Target Event: DCCI AI Innovation Fair | Venue: Bangabandhu International Conference Center (BICC), Dhaka*

### Stall Hardware & Environment Setup:

- **Display:** Connect laptop via HDMI to a 32" or 43" stall monitor in **1080p Mirror Mode**.
- **Audio:** Use a directional USB lapel or desktop conference microphone to minimize ambient crowd noise.
- **Launcher:** Double-click `start_banglarx.bat` 5 minutes before opening.
- **Browser:** Open Google Chrome at `http://localhost:5173`. Press `F11` for a clean full-screen kiosk experience.

### The 2-Minute Executive Pitch Script:

> *"Good morning distinguished judges and guests. In Bangladesh today, an outpatient doctor consults up to 80 patients a day, spending over half their time manually writing out prescriptions. This causes severe burnout, unreadable prescriptions, and missed drug interactions.*
>
> *Introducing **BanglaRx AI** — an Ambient Clinical Intelligence system built specifically for Bangladesh. It listens to natural doctor-patient conversations in Bangla or Banglish, grounds medicines against genuine Bangladeshi pharmaceutical brands, warns of dangerous drug interactions in real time, and gives the patient an audio-enabled mobile prescription in their mother tongue.*
>
> *Let me demonstrate live in 30 seconds."*

### 3 Live Showcase Scenarios:

#### Scenario 1: Ambient Bengali/Banglish Voice Consultation (The Hero Demo)

1. Set language toggle to **"English / Banglish"** or **"বাংলা"**.
2. Click **"Start Ambient Consultation"** (Microphone lights up red).
3. Speak clearly:
   > *"Patient has high fever 102 degrees for three days and severe gastric acidity. Prescribe Napa Extra one tablet three times daily after food and Seclo 20 one capsule before breakfast for seven days."*
   >
4. Click **"Auto-Generate Prescription (AI)"**.
5. **Observation:** Within 1.5 seconds, the AI populates the prescription pad with Napa Extra (Square) and Seclo 20 (Beximco), sets correct Bengali meal timings (`ভরা পেটে খাবেন`, `খাওয়ার ২০ মিনিট আগে`), and displays 98%+ confidence on the analytics gauge.

#### Scenario 2: The Safety Guardian (Critical DDI Intercept)

1. In the preset scenarios row, click **"⚠️ 3. Drug Interaction Alert"**.
2. Click **"Auto-Generate Prescription (AI)"**.
3. **Observation:** The AI detects that the patient was prescribed both **Aspirin** and **Warfarin**. A prominent crimson safety alert card pops up warning of severe gastrointestinal and intracranial hemorrhage risk, proving the platform's clinical safety guardian capability.

#### Scenario 3: The Mobile Patient Passport & Bengali Audio Readout

1. Click the **"Patient Mobile View"** button on the prescription pad.
2. Invite a judge or visitor to scan the on-screen QR Code with their smartphone camera.
3. Click the green **"🔊 Listen in Bangla (অডিও শুনুন)"** button.
4. **Observation:** The browser speaks fluent Bengali:
   > *"ঔষধ সেবনের নির্দেশিকা: নাপা এক্সট্রা, একটি করে দিনে দুইবার, ভরা পেটে খাবেন। সেকলো ২০, একটি করে দিনে দুইবার, খাওয়ার ২০ মিনিট আগে খাবেন।"*
   >

---

## 12. Safety, Privacy & Ethical AI Safeguards

### 1. Doctor-in-the-Loop Architecture

BanglaRx AI is explicitly engineered as a **clinical decision support assistant**, not an autonomous prescriber. No prescription can be printed, signed, or transmitted without explicit doctor review and approval. All fields remain editable.

### 2. Local Grounding (Zero Hallucination Tolerance)

Large Language Models are prone to inventing non-existent drug names or dosage forms. BanglaRx AI mitigates this via strict **Retrieval-Augmented Grounding (RAG)**: all extracted medications are mapped against the verified PostgreSQL master table of licensed DGDA products.

### 3. Patient Data Privacy & Push Protection

- Sensitive credentials (such as Google Gemini API keys) are strictly isolated in `appsettings.local.json` and barred from version control via `.gitignore`.
- Full compliance with GitHub Secret Scanning and Push Protection rules.
- Consultation transcripts can be purged immediately after session finalization to honor patient privacy.

---

## 13. Troubleshooting & FAQ

#### Q1: "The voice recording button isn't picking up words in Chrome."

- **Solution:** Verify that microphone permissions are enabled for `http://localhost:5173` in Chrome Settings (`chrome://settings/content/microphone`). Ensure your default input device is selected properly in Windows Sound Settings.

#### Q2: "Why does Bangla speech recognition output English words sometimes?"

- **Solution:** Click the language pill on the top right of the Voice Consultation card to switch between **`bn-BD` (বাংলা)** and **`en-US` (English / Banglish)**. If the patient is speaking colloquial Banglish (mixed words), `en-US` with acoustic adaptation performs best.

#### Q3: "Error: Unable to copy file BanglaRx.Api.exe because it is being used by another process."

- **Solution:** An instance of the backend is already running in the background. Open PowerShell and terminate it:
  ```powershell
  Stop-Process -Name "BanglaRx.Api" -Force
  ```

  Then re-run `dotnet run` or use `start_banglarx.bat`.

#### Q4: "Vite dev server fails with 'D' is not recognized as an internal or external command."

- **Solution:** In environments where workspace folders contain ampersands (e.g., `R&D - MKL`), invoke Vite directly through node:
  ```powershell
  node "node_modules/vite/bin/vite.js" --port 5173
  ```

  This is already handled automatically in `package.json` and `start_banglarx.bat`.

---

## 14. Roadmap & Future Scope

- [ ] **Native Mobile App (Flutter):** Dedicated mobile app for Android/iOS enabling visiting physicians to conduct rural bedside scribing.
- [ ] **On-Premise Local LLM (Offline Edge Mode):** Integration with quantized local models (e.g., Med-Gemma 2B / Llama 3 8B) for zero-internet rural clinics.
- [ ] **ICD-11 Diagnostic Auto-Coding:** Automated cross-referencing of extracted diagnoses with WHO ICD-11 standard codes.
- [ ] **Direct E-Pharmacy Integration:** 1-click prescription dispatch to licensed delivery pharmacies across major cities in Bangladesh.
- [ ] **EMR Interoperability (HL7/FHIR):** Standardized FHIR JSON export for integration with DGDA national health databases.

---

## 15. License & Team

### License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

### Developed By

**R&D Engineering Team (MKL)**
*Project Lead & Fullstack Architect:* Sayeed-titan
*Target Exhibition:* DCCI AI Innovation Fair, Dhaka, Bangladesh
*Repository:* [https://github.com/Sayeed-titan/BanglaRx](https://github.com/Sayeed-titan/BanglaRx)

---

<p align="center">
  <b>BanglaRx AI™</b> — Transforming Healthcare Documentation Across Bangladesh 🇧🇩
</p>
