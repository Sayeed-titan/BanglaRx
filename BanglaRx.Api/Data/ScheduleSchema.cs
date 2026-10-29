using Dapper;

namespace BanglaRx.Api.Data;

/// <summary>
/// Branches, specialties and weekly doctor schedules: the foundation for booking.
/// Idempotent like DbInitializer: safe to run on every start, only ever adds.
/// Nothing is invented: branches and specialties are derived from what the doctors table already holds,
/// and no schedule rows are created (a doctor has no sessions until someone sets them).
/// </summary>
public static class ScheduleSchema
{
    public static async Task EnsureAsync(IDbConnectionFactory connectionFactory)
    {
        try
        {
            using var db = connectionFactory.CreateConnection();
            await db.OpenAsync();

            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS branches (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL UNIQUE,
                    address TEXT,
                    phone VARCHAR(30),
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS specialties (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) NOT NULL UNIQUE
                );

                ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialty_id INT REFERENCES specialties(id);
                ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2);
                ALTER TABLE doctors ADD COLUMN IF NOT EXISTS accepts_online_booking BOOLEAN NOT NULL DEFAULT FALSE;
                ALTER TABLE doctors ADD COLUMN IF NOT EXISTS on_leave_until DATE;

                -- weekday uses .NET DayOfWeek: 0 = Sunday ... 6 = Saturday
                CREATE TABLE IF NOT EXISTS doctor_schedules (
                    id SERIAL PRIMARY KEY,
                    doctor_id INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
                    branch_id INT NOT NULL REFERENCES branches(id),
                    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    slot_minutes SMALLINT NOT NULL DEFAULT 10 CHECK (slot_minutes BETWEEN 5 AND 60),
                    CHECK (end_time > start_time)
                );
                CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor ON doctor_schedules (doctor_id, weekday);
            ");

            // Derive, never invent: one branch per hospital name already on a doctor, one specialty per specialization.
            await db.ExecuteAsync(@"
                INSERT INTO branches (name)
                SELECT DISTINCT TRIM(hospital_name) FROM doctors WHERE TRIM(COALESCE(hospital_name, '')) <> ''
                ON CONFLICT (name) DO NOTHING;

                INSERT INTO specialties (name)
                SELECT DISTINCT TRIM(specialization) FROM doctors WHERE TRIM(COALESCE(specialization, '')) <> ''
                ON CONFLICT (name) DO NOTHING;

                UPDATE doctors d SET specialty_id = s.id
                FROM specialties s
                WHERE d.specialty_id IS NULL AND s.name = TRIM(d.specialization);
            ");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Schedule Schema Note]: {ex.Message}");
        }
    }
}
