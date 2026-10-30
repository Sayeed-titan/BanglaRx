-- ============================================================================
-- SCRIPT: init_database.sql
-- PROJECT: BanglaRx AI - Ambient Clinical & Prescription Guardian
-- PURPOSE: Unified, Self-Contained DDL & Seed Data Script for PostgreSQL
-- AUTHOR: R&D Team (MKL)
-- TARGET DATABASE: BanglaRxDB
-- ============================================================================

-- Ensure standard extensions (UUID generation and trigram search for fuzzy matching)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- 0. SAFETY GUARD. This script DROPS and recreates the base tables, so it must only ever run on an EMPTY database.
-- Everything below sits in ONE transaction: if the guard raises, nothing after it runs and the final COMMIT rolls back.
-- A database whose name contains "dev" or "test" is allowed to be reset (that is how the test stack uses it).
-- ============================================================================
BEGIN;
DO $guard$
DECLARE t text; n bigint;
BEGIN
    IF current_database() ~* '(dev|test)' THEN RETURN; END IF;
    FOREACH t IN ARRAY ARRAY['patients','prescriptions','prescription_items','doctors','medicines','drug_interactions','audit_logs'] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('SELECT count(*) FROM %I', t) INTO n;
            IF n > 0 THEN
                RAISE EXCEPTION 'REFUSING TO RUN: table % already holds % rows in database %. This script drops tables; run it only on an empty database. Restore from a backup instead.', t, n, current_database();
            END IF;
        END IF;
    END LOOP;
END
$guard$;

-- ============================================================================
-- 1. DROP EXISTING OBJECTS (CLEAN SLATE / IDEMPOTENT EXECUTION)
-- ============================================================================
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS prescription_items CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS drug_interactions CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;

-- ============================================================================
-- 2. DDL: TABLE DEFINITIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: medicines (Bangladesh National Master Drug Registry)
-- ----------------------------------------------------------------------------
CREATE TABLE medicines (
    id SERIAL PRIMARY KEY,
    brand_name VARCHAR(150) NOT NULL,
    generic_name VARCHAR(150) NOT NULL,
    form VARCHAR(50) NOT NULL,              -- Tablet, Capsule, Syrup, Drop, Injection, Inhaler, Ointment
    strength VARCHAR(50) NOT NULL,           -- e.g. 500mg, 20mg, 10mg, 500mg+65mg
    manufacturer VARCHAR(150) NOT NULL,      -- Square, Beximco, Incepta, Renata, etc.
    therapeutic_class VARCHAR(150),          -- Antipyretic, PPI, Antibiotic, etc.
    standard_dosage VARCHAR(100),            -- e.g. 1+0+1, 1+1+1, 0+0+1
    instructions_bangla VARCHAR(255),        -- খাওয়ার পরে, খাওয়ার ২০ মিনিট আগে
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for ultra-fast exact and fuzzy searches
CREATE INDEX idx_medicines_brand ON medicines(brand_name);
CREATE INDEX idx_medicines_generic ON medicines(generic_name);
CREATE INDEX idx_medicines_brand_trgm ON medicines USING gin (brand_name gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- TABLE: drug_interactions (Clinical Safety Rules Engine)
-- ----------------------------------------------------------------------------
CREATE TABLE drug_interactions (
    id SERIAL PRIMARY KEY,
    generic_a VARCHAR(150) NOT NULL,
    generic_b VARCHAR(150) NOT NULL,
    severity VARCHAR(30) NOT NULL,           -- Critical, Major, Moderate, Minor
    description TEXT NOT NULL,
    clinical_advice TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ddi_lookup ON drug_interactions(generic_a, generic_b);

-- ----------------------------------------------------------------------------
-- TABLE: doctors (Physicians & Chamber Metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    degrees VARCHAR(200) NOT NULL,
    specialization VARCHAR(150) NOT NULL,
    bmdc_reg_no VARCHAR(50) UNIQUE NOT NULL,
    hospital_name VARCHAR(200) NOT NULL,
    room_no VARCHAR(50),
    phone VARCHAR(30),
    email VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- TABLE: patients (Demographics & Medical Record)
-- ----------------------------------------------------------------------------
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    patient_uid VARCHAR(50) UNIQUE NOT NULL, -- e.g. PAT-2026-0001
    full_name VARCHAR(150) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(20) NOT NULL,             -- Male, Female, Other
    phone VARCHAR(30) NOT NULL,
    blood_group VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,                 -- Diabetes, Hypertension, CKD, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patient_uid ON patients(patient_uid);
CREATE INDEX idx_patient_phone ON patients(phone);

-- ----------------------------------------------------------------------------
-- TABLE: prescriptions (Master E-Prescription Encounter)
-- ----------------------------------------------------------------------------
CREATE TABLE prescriptions (
    id SERIAL PRIMARY KEY,
    rx_number VARCHAR(50) UNIQUE NOT NULL,   -- e.g. RX-2026-8941
    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id INT NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    chief_complaints TEXT[] NOT NULL,        -- Array: ['Fever for 3 days', 'Headache']
    clinical_history TEXT,
    vitals JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"bp": "120/80", "temp": "101F", "pulse": "84"}
    diagnosis VARCHAR(255) NOT NULL,
    investigations TEXT[],                   -- Array: ['CBC', 'Serum Creatinine']
    advice_bangla TEXT[] NOT NULL,           -- Array: ['পর্যাপ্ত পানি পান করুন']
    interaction_warnings JSONB DEFAULT '[]'::jsonb,
    is_signed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prescriptions_rx_no ON prescriptions(rx_number);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);

-- ----------------------------------------------------------------------------
-- TABLE: prescription_items (Medication Line Items)
-- ----------------------------------------------------------------------------
CREATE TABLE prescription_items (
    id SERIAL PRIMARY KEY,
    prescription_id INT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medicine_id INT REFERENCES medicines(id) ON DELETE SET NULL,
    brand_name VARCHAR(150) NOT NULL,
    generic_name VARCHAR(150) NOT NULL,
    form VARCHAR(50) NOT NULL,
    strength VARCHAR(50) NOT NULL,
    dosage_pattern VARCHAR(50) NOT NULL,     -- 1+0+1, 1+1+1, 0+0+1, etc.
    duration VARCHAR(50) NOT NULL,           -- 5 days, 14 days, 1 month, Continue
    instructions_bangla VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prescription_items_rx ON prescription_items(prescription_id);

-- ----------------------------------------------------------------------------
-- TABLE: audit_logs (System & AI Audit Trail)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,        -- VOICE_INFERENCE, VISION_OCR, PREVIEW_GENERATED
    status VARCHAR(50) NOT NULL,             -- SUCCESS, WARNING, ERROR
    execution_time_ms INT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. SEED DATA: POPULATE INITIAL DATA
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. SEED: DOCTORS
-- ----------------------------------------------------------------------------
INSERT INTO doctors (name, degrees, specialization, bmdc_reg_no, hospital_name, room_no, phone, email)
VALUES 
(
    'Prof. Dr. M. A. Rahman', 
    'MBBS, FCPS (Medicine), MD (Cardiology)', 
    'Medicine & Interventional Cardiology', 
    'A-45982', 
    'Dhaka Medical College & Hospital', 
    'Chamber 402', 
    '+8801711000001', 
    'dr.rahman@banglarx.com'
),
(
    'Dr. Syeda Nusrat Jahan', 
    'MBBS, DCH, FCPS (Pediatrics)', 
    'Child & Adolescent Health Specialist', 
    'A-61204', 
    'Square Hospital, Dhaka', 
    'OPD Block B', 
    '+8801711000002', 
    'dr.nusrat@banglarx.com'
);

-- ----------------------------------------------------------------------------
-- B. SEED: DEMO PATIENTS
-- ----------------------------------------------------------------------------
INSERT INTO patients (patient_uid, full_name, age, gender, phone, blood_group, allergies, chronic_conditions)
VALUES 
(
    'PAT-2026-001', 
    'Md. Kabir Hossain', 
    45, 
    'Male', 
    '+8801819000111', 
    'B+', 
    'Penicillin', 
    'Type 2 Diabetes Mellitus, Essential Hypertension'
),
(
    'PAT-2026-002', 
    'Begum Rokeya Akter', 
    32, 
    'Female', 
    '+8801912000222', 
    'O+', 
    'None', 
    'None'
),
(
    'PAT-2026-003', 
    'Aayan Hasan (Child)', 
    6, 
    'Male', 
    '+8801715000333', 
    'A+', 
    'Sulfa drugs', 
    'Bronchial Asthma'
);

-- ----------------------------------------------------------------------------
-- C. SEED: BANGLADESH MEDICINES (TOP BRANDS ACROSS ALL MAJOR CATEGORIES)
-- ----------------------------------------------------------------------------
INSERT INTO medicines (brand_name, generic_name, form, strength, manufacturer, therapeutic_class, standard_dosage, instructions_bangla)
VALUES
-- Antipyretic / Analgesics
('Napa', 'Paracetamol', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Antipyretic / Analgesic', '1+1+1', 'ভরা পেটে খাবেন'),
('Napa Extra', 'Paracetamol + Caffeine', 'Tablet', '500mg+65mg', 'Square Pharmaceuticals', 'Analgesic', '1+0+1', 'খাওয়ার পরে'),
('Napa Rapid', 'Paracetamol (Fast Acting)', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Antipyretic', '1+1+1', 'জ্বর বেশি হলে খাওয়ার পর'),
('Napa Extend', 'Paracetamol Extended Release', 'Tablet', '665mg', 'Square Pharmaceuticals', 'Analgesic', '1+0+1', '৮ ঘন্টা পর পর ভরা পেটে'),
('Ace', 'Paracetamol', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Antipyretic', '1+1+1', 'খাওয়ার পরে'),
('Ace Plus', 'Paracetamol + Caffeine', 'Tablet', '500mg+65mg', 'Square Pharmaceuticals', 'Analgesic', '1+0+1', 'খাওয়ার পরে'),
('Fast', 'Paracetamol', 'Tablet', '500mg', 'Acme Laboratories', 'Antipyretic', '1+1+1', 'খাওয়ার পরে'),
('Renova', 'Paracetamol', 'Tablet', '500mg', 'Renata Limited', 'Antipyretic', '1+1+1', 'খাওয়ার পরে'),
('Napa Suspension', 'Paracetamol', 'Syrup', '120mg/5ml', 'Square Pharmaceuticals', 'Antipyretic', '1 চামচ দিনে ৩ বার', 'খাওয়ার পরে'),

-- Proton Pump Inhibitors (PPI) / Antacids
('Seclo 20', 'Omeprazole', 'Capsule', '20mg', 'Square Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+1', 'খাওয়ার ২০ মিনিট আগে'),
('Seclo 40', 'Omeprazole', 'Capsule', '40mg', 'Square Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+0', 'সকালে খাওয়ার ২০ মিনিট আগে'),
('Sergel 20', 'Esomeprazole', 'Capsule', '20mg', 'Healthcare Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+1', 'খাওয়ার ২০ মিনিট আগে'),
('Sergel 40', 'Esomeprazole', 'Capsule', '40mg', 'Healthcare Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+0', 'সকালে খালি পেটে'),
('Maxpro 20', 'Esomeprazole', 'Tablet', '20mg', 'Renata Limited', 'Proton Pump Inhibitor', '1+0+1', 'খাওয়ার ৩০ মিনিট আগে'),
('Maxpro 40', 'Esomeprazole', 'Tablet', '40mg', 'Renata Limited', 'Proton Pump Inhibitor', '1+0+0', 'সকালে খালি পেটে'),
('Finix 20', 'Rabeprazole', 'Tablet', '20mg', 'Opsonin Pharma', 'Proton Pump Inhibitor', '1+0+1', 'খাওয়ার ২০ মিনিট আগে'),
('Pantonix 20', 'Pantoprazole', 'Tablet', '20mg', 'Incepta Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+1', 'খাওয়ার ২০ মিনিট আগে'),
('Pantonix 40', 'Pantoprazole', 'Tablet', '40mg', 'Incepta Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+0', 'সকালে খালি পেটে'),
('Nexum 20', 'Esomeprazole', 'Tablet', '20mg', 'Square Pharmaceuticals', 'Proton Pump Inhibitor', '1+0+1', 'খাওয়ার ২০ মিনিট আগে'),
('Antacid', 'Aluminium + Magnesium Hydroxide', 'Suspension', '200ml', 'Square Pharmaceuticals', 'Antacid', '২ চামচ দিনে ৩ বার', 'খাওয়ার ১ ঘন্টা পরে'),

-- Antihistamines / Allergy
('Fexo 120', 'Fexofenadine HCl', 'Tablet', '120mg', 'Square Pharmaceuticals', 'Antihistamine', '0+0+1', 'রাতে খাওয়ার পরে'),
('Fexo 180', 'Fexofenadine HCl', 'Tablet', '180mg', 'Square Pharmaceuticals', 'Antihistamine', '0+0+1', 'রাতে খাওয়ার পরে'),
('Alatrol', 'Cetirizine Di-HCl', 'Tablet', '10mg', 'Square Pharmaceuticals', 'Antihistamine', '0+0+1', 'রাতে শোবার সময়'),
('Bilasten 20', 'Bilastine', 'Tablet', '20mg', 'Square Pharmaceuticals', 'Antihistamine', '0+0+1', 'রাতে খাওয়ার ১ ঘন্টা আগে'),
('Deslor', 'Desloratadine', 'Tablet', '5mg', 'Incepta Pharmaceuticals', 'Antihistamine', '0+0+1', 'রাতে খাওয়ার পরে'),
('Rupafin', 'Rupatadine', 'Tablet', '10mg', 'Beximco Pharmaceuticals', 'Antihistamine', '0+0+1', 'রাতে শোবার সময়'),

-- Respiratory & Anti-Asthmatic
('Monas 10', 'Montelukast Sodium', 'Tablet', '10mg', 'Square Pharmaceuticals', 'Leukotriene Receptor Antagonist', '0+0+1', 'রাতে খাওয়ার পরে'),
('Monas 5', 'Montelukast Sodium', 'Chewable Tablet', '5mg', 'Square Pharmaceuticals', 'Leukotriene Receptor Antagonist', '0+0+1', 'রাতে চিবিয়ে খাবেন'),
('Monas 4', 'Montelukast Sodium', 'Chewable Tablet', '4mg', 'Square Pharmaceuticals', 'Leukotriene Receptor Antagonist', '0+0+1', 'রাতে চিবিয়ে খাবেন'),
('Montene 10', 'Montelukast Sodium', 'Tablet', '10mg', 'Incepta Pharmaceuticals', 'Leukotriene Receptor Antagonist', '0+0+1', 'রাতে খাওয়ার পরে'),
('Windel', 'Salbutamol', 'Syrup', '2mg/5ml', 'Square Pharmaceuticals', 'Bronchodilator', '১ চামচ দিনে ৩ বার', 'খাওয়ার পরে'),
('Bexitrol F 250', 'Salmeterol + Fluticasone', 'Inhaler', '25/250mcg', 'Beximco Pharmaceuticals', 'Inhaled Corticosteroid', '২ চাপ দিনে ২ বার', 'কুলি করে মুখ ধুয়ে ফেলবেন'),

-- Antibiotics
('Ciprocin 500', 'Ciprofloxacin', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Fluoroquinolone Antibiotic', '1+0+1', 'খাওয়ার ১ ঘন্টা পর, এন্টাসিডের সাথে খাবেন না'),
('Moxaclav 625', 'Amoxicillin + Clavulanic Acid', 'Tablet', '500mg+125mg', 'Square Pharmaceuticals', 'Penicillin Antibiotic', '1+0+1', 'ভরা পেটে খাবেন'),
('Azith 500', 'Azithromycin', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Macrolide Antibiotic', '1+0+0', 'খাওয়ার ১ ঘন্টা আগে বা ২ ঘন্টা পরে'),
('Zimax 500', 'Azithromycin', 'Tablet', '500mg', 'Beximco Pharmaceuticals', 'Macrolide Antibiotic', '1+0+0', 'খাওয়ার ১ ঘন্টা আগে'),
('Cef-3 200', 'Cefixime', 'Capsule', '200mg', 'Square Pharmaceuticals', 'Cephalosporin Antibiotic', '1+0+1', 'খাওয়ার পরে'),
('Trioclav 625', 'Amoxicillin + Clavulanic Acid', 'Tablet', '625mg', 'Incepta Pharmaceuticals', 'Penicillin Antibiotic', '1+0+1', 'ভরা পেটে খাবেন'),

-- Antidiabetic
('Diapro 500', 'Metformin HCl', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Biguanide Antidiabetic', '1+0+1', 'খাওয়ার ঠিক মাঝখানে বা পরে'),
('Diapro 850', 'Metformin HCl', 'Tablet', '850mg', 'Square Pharmaceuticals', 'Biguanide Antidiabetic', '1+0+1', 'খাওয়ার ঠিক মাঝখানে বা পরে'),
('Comet 500', 'Metformin HCl', 'Tablet', '500mg', 'Square Pharmaceuticals', 'Biguanide Antidiabetic', '1+0+1', 'ভরা পেটে খাবেন'),
('Linaglip 5', 'Linagliptin', 'Tablet', '5mg', 'Square Pharmaceuticals', 'DPP-4 Inhibitor', '0+1+0', 'দুপুরে খাওয়ার সাথে'),
('Trajenta 5', 'Linagliptin', 'Tablet', '5mg', 'Boehringer Ingelheim / Beximco', 'DPP-4 Inhibitor', '0+1+0', 'দুপুরে খাওয়ার সময়'),
('Gluconor 2', 'Glimepiride', 'Tablet', '2mg', 'Square Pharmaceuticals', 'Sulfonylurea', '1+0+0', 'সকালের নাস্তার ১০ মিনিট আগে'),

-- Antihypertensive & Cardiovascular
('Bizoran 5/20', 'Amlodipine + Olmesartan', 'Tablet', '5mg+20mg', 'Square Pharmaceuticals', 'Antihypertensive', '0+0+1', 'রাতে নির্দিষ্ট সময়ে'),
('Bizoran 5/40', 'Amlodipine + Olmesartan', 'Tablet', '5mg+40mg', 'Square Pharmaceuticals', 'Antihypertensive', '0+0+1', 'রাতে নির্দিষ্ট সময়ে'),
('Angilock 50', 'Losartan Potassium', 'Tablet', '50mg', 'Square Pharmaceuticals', 'Angiotensin Receptor Blocker', '0+0+1', 'রাতে খাওয়ার পরে'),
('Osartil 50', 'Losartan Potassium', 'Tablet', '50mg', 'Incepta Pharmaceuticals', 'Angiotensin Receptor Blocker', '0+0+1', 'রাতে খাওয়ার পরে'),
('Camlosart 5/20', 'Amlodipine + Olmesartan', 'Tablet', '5mg+20mg', 'Beximco Pharmaceuticals', 'Antihypertensive', '0+0+1', 'রাতে খাওয়ার পরে'),
('Cardipin 10', 'Amlodipine', 'Tablet', '10mg', 'Square Pharmaceuticals', 'Calcium Channel Blocker', '0+0+1', 'রাতে খাবেন'),
('Betacloc 50', 'Atenolol', 'Tablet', '50mg', 'Square Pharmaceuticals', 'Beta Blocker', '1+0+0', 'সকালে খাওয়ার পরে'),
('Ecoprin 75', 'Aspirin (Low Dose)', 'Tablet', '75mg', 'Square Pharmaceuticals', 'Antiplatelet', '0+1+0', 'দুপুরে ভরা পেটে'),
('Clopid 75', 'Clopidogrel', 'Tablet', '75mg', 'Square Pharmaceuticals', 'Antiplatelet', '0+0+1', 'রাতে খাওয়ার পরে'),
('Atova 10', 'Atorvastatin', 'Tablet', '10mg', 'Square Pharmaceuticals', 'Statin / Lipid Lowering', '0+0+1', 'রাতে শোবার সময়'),
('Anclog 75', 'Clopidogrel', 'Tablet', '75mg', 'Incepta Pharmaceuticals', 'Antiplatelet', '0+0+1', 'রাতে খাওয়ার পরে'),

-- GI / Antispasmodic
('Alverin 60', 'Alverine Citrate', 'Capsule', '60mg', 'Square Pharmaceuticals', 'Antispasmodic', '1+1+1', 'পেটে ব্যথা থাকলে খাওয়ার আগে'),
('Norvis 50', 'Tiemonium Methylsulphate', 'Tablet', '50mg', 'Square Pharmaceuticals', 'Antispasmodic', '1+1+1', 'ব্যথা হলে খাওয়ার পরে'),
('Spasfon', 'Phloroglucinol', 'Tablet', '80mg', 'Incepta Pharmaceuticals', 'Antispasmodic', '1+1+1', 'ব্যথা হলে খাবেন'),

-- Multivitamins & Mineral Supplements
('B-50 Forte', 'Vitamin B Complex', 'Tablet', 'Standard', 'Square Pharmaceuticals', 'Vitamin Supplement', '1+0+1', 'খাওয়ার পরে'),
('Aristovit B', 'Vitamin B Complex', 'Tablet', 'Standard', 'Square Pharmaceuticals', 'Vitamin Supplement', '1+0+1', 'খাওয়ার পরে'),
('Calbo-D', 'Calcium Carbonate + Vitamin D3', 'Tablet', '500mg+200IU', 'Square Pharmaceuticals', 'Mineral Supplement', '0+0+1', 'রাতে ভরা পেটে'),
('Coralcal-D', 'Calcium Orotate + Vitamin D3', 'Tablet', '400mg+400IU', 'Renata Limited', 'Mineral Supplement', '0+0+1', 'রাতে ভরা পেটে'),
('Folison', 'Folic Acid', 'Tablet', '5mg', 'Square Pharmaceuticals', 'Hematopoietic', '1+0+0', 'সকালে খাওয়ার পরে');

-- ----------------------------------------------------------------------------
-- D. SEED: DRUG-DRUG INTERACTION RULES (DDI ENGINE)
-- ----------------------------------------------------------------------------
INSERT INTO drug_interactions (generic_a, generic_b, severity, description, clinical_advice)
VALUES
(
    'Ciprofloxacin', 
    'Aluminium + Magnesium Hydroxide', 
    'Major', 
    'Antacids containing aluminium or magnesium bind with Ciprofloxacin in the stomach, dramatically reducing antibiotic absorption by up to 85%.', 
    'Take Ciprofloxacin at least 2 hours before or 4 hours after antacids.'
),
(
    'Aspirin (Low Dose)', 
    'Warfarin', 
    'Critical', 
    'Concurrent use of Aspirin and Warfarin significantly increases the risk of severe gastrointestinal bleeding and systemic hemorrhage.', 
    'Avoid combination unless specifically monitored by cardiologist; monitor INR frequently.'
),
(
    'Clopidogrel', 
    'Omeprazole', 
    'Major', 
    'Omeprazole inhibits the CYP2C19 enzyme, preventing Clopidogrel from converting into its active antiplatelet form. This increases cardiovascular thrombosis risk.', 
    'Switch PPI to Pantoprazole or Rabeprazole, which do not inhibit CYP2C19.'
),
(
    'Metformin HCl', 
    'Iodinated Contrast Media', 
    'Major', 
    'Intravascular administration of iodinated radiocontrast agents can cause acute renal failure and precipitate fatal Metformin-induced lactic acidosis.', 
    'Withhold Metformin at the time of procedure and for 48 hours post-contrast.'
),
(
    'Sildenafil', 
    'Nitroglycerin', 
    'Critical', 
    'Concomitant administration leads to massive cyclic GMP accumulation and severe, potentially fatal systemic hypotension.', 
    'Absolute contraindication. Never prescribe concurrently.'
),
(
    'Losartan Potassium', 
    'Spironolactone', 
    'Major', 
    'Concurrent administration of ARBs with potassium-sparing diuretics significantly elevates serum potassium, triggering cardiac arrhythmias.', 
    'Check serum potassium and creatinine within 1 week of starting therapy.'
);

-- ----------------------------------------------------------------------------
-- E. SEED: INITIAL COMPLETED DEMO PRESCRIPTION
-- ----------------------------------------------------------------------------
INSERT INTO prescriptions (
    rx_number, doctor_id, patient_id, 
    chief_complaints, clinical_history, vitals, 
    diagnosis, investigations, advice_bangla, 
    interaction_warnings, is_signed
)
VALUES (
    'RX-2026-0001', 
    1, 
    1, 
    ARRAY['High grade fever for 3 days', 'Severe headache', 'Retro-orbital pain', 'Heartburn'],
    'Known hypertensive and diabetic on regular oral medication.',
    '{"bp": "130/85", "temp": "102.5 F", "pulse": "92 bpm", "spo2": "98%"}'::jsonb,
    'Acute Dengue Fever (Probable) with Gastropathy',
    ARRAY['CBC with ESR', 'Dengue NS1 Antigen', 'SGPT (ALT)', 'Serum Creatinine'],
    ARRAY[
        'পর্যাপ্ত পরিমাণে তরল খাবার, ডাবের পানি ও ওআরএস স্যালাইন পান করুন।',
        'কোনো ধরনের ব্যথানাশক ওষুধ (যেমন ডাইক্লোফেনাক, আইবুপ্রোফেন) গ্রহণ করবেন না।',
        'শরীরে লালচে দাগ বা রক্তপাতের লক্ষণ দেখা দিলে অবিলম্বে হাসপাতালে যোগাযোগ করুন।'
    ],
    '[]'::jsonb,
    TRUE
);

-- Insert medication items for the demo prescription
INSERT INTO prescription_items (
    prescription_id, medicine_id, brand_name, generic_name, form, strength, dosage_pattern, duration, instructions_bangla
)
VALUES 
(
    1, 
    (SELECT id FROM medicines WHERE brand_name = 'Napa Extra' LIMIT 1),
    'Napa Extra', 
    'Paracetamol + Caffeine', 
    'Tablet', 
    '500mg+65mg', 
    '1+0+1', 
    '5 days', 
    'ভরা পেটে খাবেন'
),
(
    1, 
    (SELECT id FROM medicines WHERE brand_name = 'Seclo 20' LIMIT 1),
    'Seclo 20', 
    'Omeprazole', 
    'Capsule', 
    '20mg', 
    '1+0+1', 
    '14 days', 
    'খাওয়ার ২০ মিনিট আগে'
),
(
    1, 
    (SELECT id FROM medicines WHERE brand_name = 'Monas 10' LIMIT 1),
    'Monas 10', 
    'Montelukast Sodium', 
    'Tablet', 
    '10mg', 
    '0+0+1', 
    '1 month', 
    'রাতে শোবার সময়'
);

-- ----------------------------------------------------------------------------
-- VERIFICATION LOG
-- ----------------------------------------------------------------------------
INSERT INTO audit_logs (event_type, status, execution_time_ms, details)
VALUES (
    'DATABASE_INITIALIZATION', 
    'SUCCESS', 
    45, 
    '{"message": "BanglaRxDB initialized with tables, constraints, Bangladesh pharma registry and DDI rules."}'::jsonb
);

COMMIT;
-- End of script
