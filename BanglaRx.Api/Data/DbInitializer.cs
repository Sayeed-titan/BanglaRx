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
