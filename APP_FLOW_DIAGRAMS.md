# BanglaRx AI - Application Flow Diagrams

Editable text diagrams (Mermaid). They draw automatically in GitHub, VS Code (Markdown preview
or the "Markdown Preview Mermaid Support" extension) and https://mermaid.live (paste a block to edit,
then copy it back). To change a diagram, edit the text inside its ```mermaid block.

Colour key used in every diagram:
- GREEN = built and working today
- AMBER = planned (not built yet)
- GREY  = outside service we connect to

Contents: 1 System map | 2 Who sees what | 3 Patient journey | 4 Phone-code login |
5 Booking rules | 6 Doctor consultation | 7 The two AIs | 8 Data model | 9 Deployment | 10 Release steps

---

## 1. System map (all parts and how they talk)

```mermaid
flowchart LR
    classDef built fill:#d9f2e3,stroke:#1f7a4d,color:#0b3d26
    classDef plan fill:#fff1cc,stroke:#b7791f,color:#5a3b00
    classDef ext fill:#eceff1,stroke:#607d8b,color:#263238

    subgraph Browser["Phone or computer - one installable web app (PWA)"]
        PUB["Public site + Rubina chat"]:::plan
        PAT["Patient portal"]:::built
        DOC["Doctor + assistant: queue and prescription pad"]:::built
        REC["Reception: bookings, check-in, registration"]:::built
        PHA["Pharmacy"]:::built
        MGR["Manager / IT: users, schedules, dashboard"]:::built
    end

    PROXY["IIS web server on the VM\nHTTPS, serves the app, forwards /api"]:::plan

    subgraph API["ASP.NET Core API - Windows service, port 5000 (localhost only)"]
        AUTH["Sign-in + role guard\n(staff password, patient phone code)"]:::built
        BOOK["Booking + slots"]:::built
        QUEUE["Queue + patients"]:::built
        RX["Prescriptions\nsave, edit, versions, audit"]:::built
        SAFE["Safety engine\nallergy, duplicate, interaction, dose"]:::built
        RES["Medicine resolver"]:::built
        SCRIBE["AI scribe service"]:::built
        CONCIERGE["Rubina service"]:::plan
        PHARM["Pharmacy service"]:::built
    end

    DB[("PostgreSQL BanglaRxDB")]:::built
    LLM["Gemini LLM"]:::ext
    SMS["SMS gateway"]:::ext
    WA["WhatsApp"]:::ext

    PUB & PAT & DOC & REC & PHA & MGR -->|HTTPS| PROXY
    PROXY -->|"/api/*"| AUTH
    AUTH --> BOOK & QUEUE & RX & PHARM & CONCIERGE
    DOC -->|"speech or typing"| SCRIBE
    SCRIBE --> RES --> SAFE
    SCRIBE -->|"prompt"| LLM
    CONCIERGE -->|"prompt"| LLM
    AUTH -->|"login code"| SMS
    BOOK -->|"reminders (later)"| SMS
    CONCIERGE -.->|"later"| WA
    BOOK & QUEUE & RX & SAFE & RES & PHARM & AUTH & CONCIERGE --> DB
```

---

## 2. Who sees what (roles)

```mermaid
flowchart TB
    classDef built fill:#d9f2e3,stroke:#1f7a4d,color:#0b3d26
    classDef plan fill:#fff1cc,stroke:#b7791f,color:#5a3b00

    V["Visitor - no login"] --> V1["Home, doctors list, Rubina chat"]:::plan
    P["Patient - phone code"] --> P1["Book, family profiles, my bookings, live queue"]:::built
    P --> P2["My prescriptions"]:::plan
    D["Doctor"] --> D1["Own queue, AI scribe, prescription pad, templates, own schedule"]:::built
    A["Assistant"] --> A1["Same as the doctor they work for - can draft, doctor signs"]:::built
    R["Receptionist"] --> R1["Bookings, move, cancel, check-in, register patients"]:::built
    F["Pharmacist"] --> F1["Prescriptions to dispense"]:::built
    M["Manager / IT"] --> M1["Users and roles, schedules, branches, dashboard, sign-in log"]:::built

    RULE["Rule: the server decides access (Auth/RoleGuard.cs).\nHiding a menu is only for tidiness. A new endpoint is manager-only until a row is added."]
```

---

## 3. Patient journey (public chat to the consultation)

```mermaid
sequenceDiagram
    autonumber
    actor Pt as Patient
    participant App as Web app (PWA)
    participant Ru as Rubina (public AI)
    participant API as API
    participant DB as Database
    participant Desk as Reception
    actor Dr as Doctor

    Pt->>App: Open the public link
    Pt->>Ru: Describe the problem (Bangla or English)
    Ru->>DB: Read doctors, specialties, schedules, fees
    Ru-->>Pt: Suggests specialty, doctor, place, next free time
    Note over Ru,Pt: Emergency words (chest pain, breathing trouble...)<br/>get "go to emergency / call 999", no booking
    Pt->>App: Press "Book this slot"
    App->>Pt: Ask for phone number (login, see diagram 4)
    Pt->>API: Confirm who it is for (me or family member)
    API->>DB: Save booking (unique doctor + date + time)
    API-->>Pt: Booking confirmed + reminder SMS
    Note over Pt,Desk: Day of visit
    Pt->>Desk: Arrives
    Desk->>API: Press "Arrived"
    API->>DB: Booking becomes next queue token
    Pt->>App: Opens queue view
    App-->>Pt: My token, now serving, people ahead
    Dr->>API: Open patient from queue
    Note over Dr: Continue with diagram 6
```

---

## 4. Phone-code login and finding the patient's old records

```mermaid
sequenceDiagram
    autonumber
    actor Pt as Patient
    participant App as Web app
    participant API as API
    participant DB as Database
    participant SMS as SMS gateway

    Pt->>App: Types mobile number
    App->>API: request-code
    API->>API: Normalise to +8801XXXXXXXXX, check limits (3 per number, 20 per device, 10 min)
    API->>DB: Save code as a keyed hash (valid 5 min, one use)
    API->>SMS: Send 6-digit code
    SMS-->>Pt: SMS arrives
    Pt->>App: Types the code
    App->>API: verify
    API->>DB: Newest live code matches? (max 5 wrong tries)
    alt code right
        API->>DB: Create or find patient account for this number
        API->>DB: Link every existing patient record with the same last 10 digits
        API-->>App: Patient token (14 days, patient-only)
    else code wrong or expired
        API-->>App: Same neutral message (never says if the number is known)
    end
    App-->>Pt: Home: people on this account, bookings, queue
```

---

## 5. Booking rules (what the server checks)

```mermaid
flowchart TD
    classDef built fill:#d9f2e3,stroke:#1f7a4d,color:#0b3d26
    S["Patient picks doctor, day, time"]:::built --> C1{"Doctor allows online booking?"}:::built
    C1 -- no --> X1["Not offered"]:::built
    C1 -- yes --> C2{"Doctor has a session that weekday and is not on leave?"}:::built
    C2 -- no --> X2["Day shows 'nothing available' with the reason"]:::built
    C2 -- yes --> C3{"Branch switched on? Time at least 15 min away and within 30 days?"}:::built
    C3 -- no --> X3["Time not offered"]:::built
    C3 -- yes --> C4{"Same person already booked this doctor this day?"}:::built
    C4 -- yes --> X4["Refused: one live booking per person, per doctor, per day"]:::built
    C4 -- no --> C5{"Patient already has 5 upcoming bookings?"}:::built
    C5 -- yes --> X5["Refused"]:::built
    C5 -- no --> C6{"Slot still free? (database unique index)"}:::built
    C6 -- taken --> X6["'Just taken' - nothing saved"]:::built
    C6 -- free --> OK["Booking saved"]:::built
    OK --> CAN{"Cancel later?"}:::built
    CAN -- "2 hours or more before" --> FREE["Cancelled, slot free again"]:::built
    CAN -- "less than 2 hours" --> CALL["Told to call the clinic"]:::built
```

---

## 6. Doctor consultation (prescription creation)

```mermaid
flowchart TD
    classDef built fill:#d9f2e3,stroke:#1f7a4d,color:#0b3d26
    classDef plan fill:#fff1cc,stroke:#b7791f,color:#5a3b00

    Q["Queue: pick next patient"]:::built --> PAD["Prescription pad opens\nvitals, allergies, chronic conditions, age, weight"]:::built
    PAD --> FAST{"Faster start?"}:::built
    FAST -- "Repeat last Rx" --> EDIT
    FAST -- "Apply my template" --> EDIT
    FAST -- "Speak or type" --> AI["AI scribe reads what was said\nonly what was actually said, blanks stay blank"]:::built
    AI --> RES["Medicine resolver\nexact / ambiguous / strength unavailable / fuzzy / unmatched"]:::built
    RES --> SAFE["Safety engine - fixed rules, not the AI\nallergy class, duplicate ingredient, interaction, dose ceiling, child mg per kg"]:::built
    SAFE --> EDIT["Doctor reviews and edits any field\n1-click chooser for unclear medicines"]:::built
    EDIT --> ALERT{"Red or amber safety strip?"}:::built
    ALERT -- yes --> FIX["Doctor fixes or accepts knowingly"]:::built --> EDIT
    ALERT -- no --> MISS{"Dosage or duration missing?"}:::built
    MISS -- yes --> ASK["Confirm before saving"]:::built --> SIGN
    MISS -- no --> SIGN["Save / sign (Ctrl+S)"]:::built
    SIGN --> NEW{"First save?"}:::built
    NEW -- yes --> POST["Create: Rx number RX-yyyymmdd-00001"]:::built
    NEW -- no --> PUT["Edit: version + 1, old copy kept in audit log"]:::built
    POST --> PRINT["Print A4 prescription"]:::built
    PUT --> PRINT
    PRINT --> PH["Pharmacy sees it"]:::built
    PRINT --> DONE["Queue item completed"]:::built
    PH -.-> DISP["Dispense record"]:::plan
    PRINT -.-> PTRX["Patient sees it in the portal"]:::plan
```

---

## 7. The two AIs (kept separate on purpose)

```mermaid
flowchart LR
    classDef built fill:#d9f2e3,stroke:#1f7a4d,color:#0b3d26
    classDef plan fill:#fff1cc,stroke:#b7791f,color:#5a3b00

    subgraph S["AI Scribe - for the doctor (built)"]
        S1["Input: dictation + this patient's allergies, age, weight"]:::built
        S2["Output: vitals, symptoms, diagnosis, medicines, advice, follow-up"]:::built
        S3["Rules: never invent; blank stays blank; every medicine named is kept and flagged if not found"]:::built
        S4["Checked by: 30-case dictation test (medicines 97%, dosage 100%, 0 invented)"]:::built
        S1 --> S2 --> S3 --> S4
    end

    subgraph R["Rubina - for the public (planned)"]
        R1["Input: patient's words + live doctor, schedule, fee, branch data"]:::plan
        R2["Output: which specialty, which doctor, where, when, answers to questions"]:::plan
        R3["Rules: no diagnosis, no medicine names or doses; emergencies go to 999 / emergency room; no personal data kept"]:::plan
        R4["Protection: rate limit, message size limit, daily cost cap"]:::plan
        R5["Checked by: own test set (messages to expected specialty; emergencies must escalate)"]:::plan
        R1 --> R2 --> R3 --> R4 --> R5
    end
```

---

## 8. Data model (main tables)

```mermaid
erDiagram
    BRANCHES ||--o{ DOCTOR_SCHEDULES : has
    DOCTORS ||--o{ DOCTOR_SCHEDULES : works
    SPECIALTIES ||--o{ DOCTORS : classifies
    PATIENTS ||--o{ BOOKINGS : makes
    DOCTORS ||--o{ BOOKINGS : receives
    BOOKINGS ||--o| APPOINTMENTS : "becomes queue token"
    PATIENTS ||--o{ APPOINTMENTS : waits
    DOCTORS ||--o{ APPOINTMENTS : sees
    PATIENTS ||--o{ PRESCRIPTIONS : gets
    DOCTORS ||--o{ PRESCRIPTIONS : writes
    PRESCRIPTIONS ||--|{ PRESCRIPTION_ITEMS : contains
    MEDICINES ||--o{ PRESCRIPTION_ITEMS : "matched to"
    MEDICINES ||--o{ MEDICINE_ALIASES : "Bangla spellings"
    DOCTORS ||--o{ RX_TEMPLATES : saves
    PRESCRIPTIONS ||--o{ AUDIT_LOGS : "old versions"
    PATIENT_ACCOUNTS ||--o{ PATIENT_ACCOUNT_PROFILES : owns
    PATIENTS ||--o{ PATIENT_ACCOUNT_PROFILES : "linked by phone"
    PATIENT_ACCOUNTS ||--o{ OTP_CODES : "login codes"
    USERS ||--o{ AUTH_EVENTS : "sign-in log"
    DOCTORS ||--o| USERS : "staff login"

    PATIENTS {
        int id
        string patient_uid
        string phone
        string allergies
        string chronic_conditions
    }
    BOOKINGS {
        int id
        date day
        time slot
        string status
        string channel
    }
    APPOINTMENTS {
        int id
        int token_number
        string status
    }
    PRESCRIPTIONS {
        int id
        string rx_number
        int version
        jsonb general_signs
        string follow_up
    }
    PRESCRIPTION_ITEMS {
        int id
        string brand_name
        string dosage_pattern
        string duration
    }
    PATIENT_ACCOUNTS {
        int id
        string phone
        int token_version
    }
    OTP_CODES {
        int id
        string code_hash
        datetime expires_at
        int attempts
    }
    USERS {
        int id
        string username
        string role
    }
```

Other tables: `app_secrets` (token signing key), `drug_interactions` and the medicine catalogue (currently 63 medicines, 15K planned).

---

## 9. Deployment (one Windows VM with IIS)

```mermaid
flowchart TB
    classDef plan fill:#fff1cc,stroke:#b7791f,color:#5a3b00
    classDef ext fill:#eceff1,stroke:#607d8b,color:#263238

    U["Phones and computers"]:::ext -->|"https://our-domain, port 443"| FW["Windows Firewall: only 80 and 443 open"]:::plan
    FW --> IIS["IIS site 'banglarx'\nTLS certificate (win-acme), web.config rules"]:::plan

    subgraph VM["Windows VM"]
        IIS -->|"all pages"| WEB["C:\\banglarx\\web\nReact build + PWA files"]:::plan
        IIS -->|"/api/* via URL Rewrite + ARR"| SVC["BanglaRx API\nWindows service (NSSM), 127.0.0.1:5000"]:::plan
        SVC --> PG[("PostgreSQL, 127.0.0.1:5432")]:::plan
        SVC --> CFG["appsettings.local.json\nsecrets, never in git"]:::plan
        PG --> BK["Nightly backup to C:\\banglarx\\backups\nthen copy off the VM"]:::plan
    end

    SVC -->|"outbound HTTPS"| GEM["Gemini"]:::ext
    SVC -->|"outbound HTTPS"| SMSG["SMS gateway"]:::ext
```

---

## 10. Build and release order

```mermaid
flowchart LR
    classDef built fill:#d9f2e3,stroke:#1f7a4d,color:#0b3d26
    classDef plan fill:#fff1cc,stroke:#b7791f,color:#5a3b00

    A["Done: prescription accuracy,\nsafety, sign-in and roles,\nbooking, patient portal"]:::built
    B["1. Rubina chat +\ndoctor finder"]:::plan
    C["2. Real URLs + PWA"]:::plan
    D["3. Production settings:\nCORS, Auth on, /api base"]:::plan
    E["4. VM: IIS, service,\nHTTPS, backups"]:::plan
    F["5. Real SMS, realistic data,\nbranding"]:::plan
    G["6. Full rehearsal\non a phone"]:::plan
    H["7. Freeze 2 days\nbefore the event"]:::plan
    A --> B --> C --> D --> E --> F --> G --> H
```

Details behind steps 3-7 are in `DEPLOYMENT_PLAN.md`. Day-to-day workflow rules are in `FULLSTACK_WORKFLOW.md`.
