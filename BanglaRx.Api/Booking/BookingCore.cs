using System.Globalization;
using BanglaRx.Api.Data;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.Booking;

public class BookingOptions
{
    /// <summary>Clinic time = UTC + this many hours. Bangladesh has no daylight saving, so a fixed offset is enough.</summary>
    public double UtcOffsetHours { get; set; } = 6;
    /// <summary>A slot is not offered if it starts sooner than this many minutes from now.</summary>
    public int MinLeadMinutes { get; set; } = 15;
    public int MaxDaysAhead { get; set; } = 30;
    /// <summary>Tests only: freezes "now" (clinic time, like 2026-11-02T10:00:00) so date rules can be checked exactly.</summary>
    public string? FakeNow { get; set; }
}

/// <summary>The clinic's wall clock. Every date and time in a booking means clinic time.</summary>
public class ClinicClock
{
    private readonly BookingOptions _o;
    private readonly DateTime? _fake;

    public ClinicClock(BookingOptions o)
    {
        _o = o;
        if (DateTime.TryParse(o.FakeNow, CultureInfo.InvariantCulture, DateTimeStyles.None, out var f)) _fake = f;
    }

    public DateTime Now => _fake ?? DateTime.UtcNow.AddHours(_o.UtcOffsetHours);
    public DateOnly Today => DateOnly.FromDateTime(Now);
    public BookingOptions Options => _o;
}

public static class BookingSchema
{
    public static readonly string[] Sources = { "front_desk", "phone", "whatsapp", "app", "web" };
    /// <summary>Requests that arrive through these channels may only book doctors who have switched online booking on.</summary>
    public static readonly string[] OnlineSources = { "whatsapp", "app", "web" };

    public static async Task EnsureAsync(IDbConnectionFactory f)
    {
        try
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            // Bookings are their own table. Today's queue (appointments) is for people who are physically here;
            // checking a patient in turns a booking into a queue token.
            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS bookings (
                    id SERIAL PRIMARY KEY,
                    doctor_id INT NOT NULL REFERENCES doctors(id),
                    branch_id INT NOT NULL REFERENCES branches(id),
                    patient_id INT NOT NULL REFERENCES patients(id),
                    slot_date DATE NOT NULL,
                    slot_time TIME NOT NULL,
                    slot_minutes SMALLINT NOT NULL,
                    source VARCHAR(20) NOT NULL DEFAULT 'front_desk' CHECK (source IN ('front_desk','phone','whatsapp','app','web')),
                    status VARCHAR(20) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','arrived','cancelled','no_show')),
                    reason TEXT,
                    appointment_id INT REFERENCES appointments(id),
                    created_by INT,
                    cancelled_by INT,
                    cancel_reason TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    cancelled_at TIMESTAMP WITH TIME ZONE
                );
                -- the database itself refuses a second live booking for the same doctor and time
                CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_slot ON bookings (doctor_id, slot_date, slot_time) WHERE status IN ('booked','arrived');
                CREATE INDEX IF NOT EXISTS idx_bookings_day ON bookings (slot_date, doctor_id);
                CREATE INDEX IF NOT EXISTS idx_bookings_patient ON bookings (patient_id);
            ");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Booking Schema Note]: {ex.Message}");
        }
    }
}

public record SlotInfo(string Time, int Minutes, int BranchId, string BranchName, string State, int? BookingId);
public record SlotDay(string Date, int DoctorId, string? Note, List<SlotInfo> Slots);

/// <summary>Turns a doctor's weekly sessions into the actual appointments for one date.</summary>
public static class SlotService
{
    private const string TimeFormat = "HH:mm";

    private record SessionRow(int BranchId, string BranchName, string StartTime, string EndTime, int SlotMinutes);
    private record BookedRow(int Id, string SlotTime);

    public static async Task<SlotDay> BuildAsync(NpgsqlConnection db, ClinicClock clock, int doctorId, DateOnly date, NpgsqlTransaction? tx = null)
    {
        var iso = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var today = clock.Today;
        List<SlotInfo> none = new();

        if (date < today) return new SlotDay(iso, doctorId, "That date has already passed.", none);
        if (date > today.AddDays(clock.Options.MaxDaysAhead)) return new SlotDay(iso, doctorId, $"Booking opens {clock.Options.MaxDaysAhead} days ahead.", none);

        var leaveText = await db.ExecuteScalarAsync<string?>("SELECT to_char(on_leave_until, 'YYYY-MM-DD') FROM doctors WHERE id = @doctorId;", new { doctorId }, tx);
        if (leaveText is not null && DateOnly.TryParseExact(leaveText, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var leave) && leave >= date)
            return new SlotDay(iso, doctorId, $"The doctor is on leave until {leaveText}.", none);

        var sessions = (await db.QueryAsync<SessionRow>(@"
            SELECT s.branch_id AS BranchId, b.name AS BranchName, to_char(s.start_time, 'HH24:MI') AS StartTime,
                   to_char(s.end_time, 'HH24:MI') AS EndTime, s.slot_minutes::int AS SlotMinutes
            FROM doctor_schedules s JOIN branches b ON b.id = s.branch_id AND b.is_active
            WHERE s.doctor_id = @doctorId AND s.weekday = @weekday ORDER BY s.start_time;",
            new { doctorId, weekday = (short)date.DayOfWeek }, tx)).ToList();
        if (sessions.Count == 0) return new SlotDay(iso, doctorId, "The doctor has no session on this day.", none);

        var booked = (await db.QueryAsync<BookedRow>(@"
            SELECT id, to_char(slot_time, 'HH24:MI') AS SlotTime FROM bookings
            WHERE doctor_id = @doctorId AND slot_date = @date::date AND status IN ('booked','arrived');",
            new { doctorId, date = iso }, tx)).ToDictionary(b => b.SlotTime, b => b.Id);

        var earliest = clock.Now.AddMinutes(clock.Options.MinLeadMinutes);
        var slots = new List<SlotInfo>();
        foreach (var s in sessions)
        {
            var t = TimeOnly.ParseExact(s.StartTime, TimeFormat, CultureInfo.InvariantCulture);
            var end = TimeOnly.ParseExact(s.EndTime, TimeFormat, CultureInfo.InvariantCulture);
            while (t.AddMinutes(s.SlotMinutes) <= end && t.AddMinutes(s.SlotMinutes) > t)
            {
                var label = t.ToString(TimeFormat, CultureInfo.InvariantCulture);
                var state = booked.ContainsKey(label) ? "booked" : date.ToDateTime(t) < earliest ? "closed" : "open";
                slots.Add(new SlotInfo(label, s.SlotMinutes, s.BranchId, s.BranchName, state, booked.TryGetValue(label, out var id) ? id : null));
                t = t.AddMinutes(s.SlotMinutes);
            }
        }
        return new SlotDay(iso, doctorId, null, slots);
    }
}
