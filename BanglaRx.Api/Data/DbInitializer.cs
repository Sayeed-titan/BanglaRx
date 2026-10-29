using Dapper;

namespace BanglaRx.Api.Data;

public static class DbInitializer
{
    public static async Task EnsureDatabaseSchemaAsync(IDbConnectionFactory connectionFactory)
    {
        try
        {
            using var db = connectionFactory.CreateConnection();
            await db.OpenAsync();

            // 1. Enable PostgreSQL pg_trgm for ultra-fast candidate fuzzy matching (<3ms across 15,000+ medicines)
            await db.ExecuteAsync("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

            // 2. Create GIN index on brand_name and generic_name for Two-Stage Hybrid RAG
            await db.ExecuteAsync(@"
                CREATE INDEX IF NOT EXISTS idx_medicines_trgm 
                ON medicines USING gin (brand_name gin_trgm_ops, generic_name gin_trgm_ops);
            ");

            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS appointments (
                    id SERIAL PRIMARY KEY,
                    token_number INT NOT NULL,
                    doctor_id INT NOT NULL,
                    patient_id INT NOT NULL,
                    status VARCHAR(30) NOT NULL DEFAULT 'Waiting',
                    triage_vitals JSONB DEFAULT '{}'::jsonb,
                    chief_complaint TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            ");

            // 3. Prescription completeness: fields the pad edits but the original schema dropped
            await db.ExecuteAsync(@"
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS follow_up TEXT;
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS referred_to TEXT;
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS general_signs JSONB NOT NULL DEFAULT '{}'::jsonb;
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS exam_notes TEXT;
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS red_flags TEXT;
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_reports TEXT[];
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
                ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                ALTER TABLE prescriptions ALTER COLUMN diagnosis DROP NOT NULL;
                ALTER TABLE prescriptions ALTER COLUMN advice_bangla DROP NOT NULL;
                CREATE SEQUENCE IF NOT EXISTS rx_number_seq;
            ");

            // 4. Bangla/Banglish spoken names -> formulary names (extend by inserting rows, no code change)
            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS medicine_aliases (
                    id SERIAL PRIMARY KEY,
                    alias TEXT NOT NULL UNIQUE,
                    target TEXT NOT NULL
                );
                INSERT INTO medicine_aliases (alias, target) VALUES
                ('নাপা','Napa'),('সেকলো','Seclo'),('সার্জেল','Sergel'),('মোনাস','Monas'),
                ('প্যারাসিটামল','Paracetamol'),('অ্যাজিথ্রোমাইসিন','Azithromycin'),('অ্যাজিথ্রো','Azith'),
                ('ডায়াপ্রো','Diapro'),('বাইজোরান','Bizoran'),('এটোভা','Atova'),
                ('সিপ্রোসিন','Ciprocin'),('ওমিপ্রাজল','Omeprazole'),('এসোমিপ্রাজল','Esomeprazole'),
                ('মেটফরমিন','Metformin'),('অ্যামলোডিপিন','Amlodipine'),('লোসারটান','Losartan'),
                ('অ্যাটোরভাস্ট্যাটিন','Atorvastatin'),('মন্টেলুকাস্ট','Montelukast'),('সেটিরিজিন','Cetirizine'),
                ('ফেক্সো','Fexo'),('প্যান্টোনিক্স','Pantonix'),('নেক্সাম','Nexum'),
                ('ম্যাক্সপ্রো','Maxpro'),('ফাইনিক্স','Finix'),('অ্যালাট্রল','Alatrol'),
                ('ক্লোপিড','Clopid'),('ইকোপ্রিন','Ecoprin'),('অ্যাস্পিরিন','Aspirin'),
                ('ওয়ারফারিন','Warfarin'),('সিপ্রোফ্লক্সাসিন','Ciprofloxacin'),('অ্যামোক্সিসিলিন','Amoxicillin'),
                ('স্যালবুটামল','Salbutamol'),('ফলিক অ্যাসিড','Folic'),('ক্যালবো','Calbo')
                ON CONFLICT (alias) DO NOTHING;
            ");

            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS rx_templates (
                    id SERIAL PRIMARY KEY,
                    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (doctor_id, name)
                );
            ");

            var count = await db.ExecuteScalarAsync<int>("SELECT count(*) FROM appointments;");
            if (count == 0)
            {
                var pIds = (await db.QueryAsync<int>("SELECT id FROM patients ORDER BY id ASC LIMIT 3;")).ToList();
                var dId = await db.ExecuteScalarAsync<int>("SELECT id FROM doctors ORDER BY id ASC LIMIT 1;");
                if (pIds.Count > 0 && dId > 0)
                {
                    await db.ExecuteAsync(@"
                        INSERT INTO appointments (token_number, doctor_id, patient_id, status, triage_vitals, chief_complaint)
                        VALUES 
                        (1, @dId, @p1, 'In Consultation', '{""bp"": ""120/80 mmHg"", ""temp"": ""102 F"", ""pulse"": ""84 bpm""}'::jsonb, 'High fever for 3 days and gastric burning');
                    ", new { dId, p1 = pIds[0] });

                    if (pIds.Count > 1)
                    {
                        await db.ExecuteAsync(@"
                            INSERT INTO appointments (token_number, doctor_id, patient_id, status, triage_vitals, chief_complaint)
                            VALUES 
                            (2, @dId, @p2, 'Waiting', '{""bp"": ""145/95 mmHg"", ""temp"": ""98.4 F"", ""pulse"": ""76 bpm""}'::jsonb, 'Follow-up for chronic diabetes & uncontrolled BP');
                        ", new { dId, p2 = pIds[1] });
                    }

                    if (pIds.Count > 2)
                    {
                        await db.ExecuteAsync(@"
                            INSERT INTO appointments (token_number, doctor_id, patient_id, status, triage_vitals, chief_complaint)
                            VALUES 
                            (3, @dId, @p3, 'Waiting', '{""bp"": ""115/75 mmHg"", ""temp"": ""99.1 F"", ""pulse"": ""80 bpm""}'::jsonb, 'Persistent dry cough, sore throat and weakness');
                        ", new { dId, p3 = pIds[2] });
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database Initialization Note]: {ex.Message}");
        }
    }
}
