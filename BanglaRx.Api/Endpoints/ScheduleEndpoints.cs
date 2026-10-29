using System.Globalization;
using BanglaRx.Api.Data;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.Endpoints;

public record BranchInput(string? Name, string? Address, string? Phone, bool? IsActive);
public record SessionInput(int BranchId, int Weekday, string? StartTime, string? EndTime, int SlotMinutes);
public record ScheduleInput(decimal? ConsultationFee, bool? AcceptsOnlineBooking, string? OnLeaveUntil, List<SessionInput>? Sessions);

public record SessionRow(int Id, int BranchId, string BranchName, int Weekday, string StartTime, string EndTime, int SlotMinutes);
public record DoctorScheduleRow(
    int Id, string Name, string Specialization, string? RoomNo, string? HospitalName,
    decimal? ConsultationFee, bool AcceptsOnlineBooking, string? OnLeaveUntil);
public record DoctorSchedule(DoctorScheduleRow Doctor, List<SessionRow> Sessions);

/// <summary>Branches, specialties and each doctor's weekly sessions.</summary>
public static class ScheduleEndpoints
{
    private const string TimeFormat = "HH:mm";

    public static void MapScheduleEndpoints(this IEndpointRouteBuilder app)
    {
        var branches = app.MapGroup("/api/branches").WithTags("Branches");

        branches.MapGet("/", async (IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            return Results.Ok(await db.QueryAsync<dynamic>(
                "SELECT id, name, address, phone, is_active FROM branches ORDER BY name ASC;"));
        });

        branches.MapPost("/", async (BranchInput req, IDbConnectionFactory f) =>
        {
            var name = req.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest(new { Errors = new[] { "Branch name is required." } });
            if (name.Length > 200) return Results.BadRequest(new { Errors = new[] { "Branch name is too long." } });

            using var db = f.CreateConnection();
            try
            {
                var id = await db.QuerySingleAsync<int>(
                    "INSERT INTO branches (name, address, phone) VALUES (@name, @address, @phone) RETURNING id;",
                    new { name, address = req.Address?.Trim(), phone = req.Phone?.Trim() });
                return Results.Ok(new { Id = id, Name = name });
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { Errors = new[] { $"A branch named \"{name}\" already exists." } });
            }
        });

        branches.MapPut("/{id:int}", async (int id, BranchInput req, IDbConnectionFactory f) =>
        {
            var name = req.Name?.Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest(new { Errors = new[] { "Branch name is required." } });

            using var db = f.CreateConnection();
            try
            {
                var n = await db.ExecuteAsync(@"
                    UPDATE branches SET name = @name, address = @address, phone = @phone, is_active = COALESCE(@isActive, is_active)
                    WHERE id = @id;", new { id, name, address = req.Address?.Trim(), phone = req.Phone?.Trim(), isActive = req.IsActive });
                return n == 0 ? Results.NotFound() : Results.Ok(new { Id = id, Name = name });
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { Errors = new[] { $"A branch named \"{name}\" already exists." } });
            }
        });

        app.MapGet("/api/specialties", async (IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            return Results.Ok(await db.QueryAsync<dynamic>("SELECT id, name FROM specialties ORDER BY name ASC;"));
        });

        // Every doctor with their weekly sessions
        app.MapGet("/api/schedules", async (IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            return Results.Ok(await LoadAllAsync(db));
        });

        // Replace one doctor's week (and their booking settings) in one transaction
        app.MapPut("/api/doctors/{id:int}/schedule", async (int id, ScheduleInput req, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();

            var exists = await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM doctors WHERE id = @id);", new { id });
            if (!exists) return Results.NotFound(new { Errors = new[] { "Doctor not found." } });

            var branchIds = (await db.QueryAsync<int>("SELECT id FROM branches WHERE is_active;")).ToHashSet();
            var (sessions, leave, errors) = Validate(req, branchIds);
            if (errors.Count > 0) return Results.BadRequest(new { Errors = errors });

            using var tx = await db.BeginTransactionAsync();
            await db.ExecuteAsync(@"
                UPDATE doctors SET
                    consultation_fee = @fee::numeric,
                    accepts_online_booking = @online,
                    on_leave_until = @leave::date
                WHERE id = @id;",
                new { id, fee = req.ConsultationFee, online = req.AcceptsOnlineBooking ?? false, leave }, tx);

            await db.ExecuteAsync("DELETE FROM doctor_schedules WHERE doctor_id = @id;", new { id }, tx);
            foreach (var s in sessions)
            {
                await db.ExecuteAsync(@"
                    INSERT INTO doctor_schedules (doctor_id, branch_id, weekday, start_time, end_time, slot_minutes)
                    VALUES (@id, @branchId, @weekday, @start::time, @end::time, @slot);",
                    new { id, branchId = s.BranchId, weekday = (short)s.Weekday, start = s.Start, end = s.End, slot = (short)s.SlotMinutes }, tx);
            }
            await tx.CommitAsync();

            var all = await LoadAllAsync(db);
            return Results.Ok(all.First(d => d.Doctor.Id == id));
        });
    }

    public record CleanSession(int BranchId, int Weekday, string Start, string End, int SlotMinutes);

    /// <summary>Everything the screen would otherwise have to trust: ranges, order, overlaps, branches.</summary>
    public static (List<CleanSession> Sessions, DateOnly? Leave, List<string> Errors) Validate(ScheduleInput req, HashSet<int> activeBranchIds)
    {
        var errors = new List<string>();
        var clean = new List<CleanSession>();
        DateOnly? leave = null;

        if (req.ConsultationFee is < 0 or > 1_000_000) errors.Add("The visit fee must be between 0 and 1,000,000.");

        if (!string.IsNullOrWhiteSpace(req.OnLeaveUntil))
        {
            if (DateOnly.TryParseExact(req.OnLeaveUntil, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)) leave = d;
            else errors.Add("\"On leave until\" must be a date like 2026-11-03.");
        }

        var sessions = req.Sessions ?? new List<SessionInput>();
        if (sessions.Count > 28) errors.Add("At most 28 sessions per doctor.");

        for (var i = 0; i < sessions.Count && sessions.Count <= 28; i++)
        {
            var s = sessions[i];
            var label = $"Session {i + 1}";
            if (s.Weekday is < 0 or > 6) { errors.Add($"{label}: weekday must be 0 (Sunday) to 6 (Saturday)."); continue; }
            if (!activeBranchIds.Contains(s.BranchId)) { errors.Add($"{label}: the branch does not exist or is switched off."); continue; }
            if (s.SlotMinutes is < 5 or > 60) { errors.Add($"{label}: minutes per patient must be between 5 and 60."); continue; }
            if (!TimeOnly.TryParseExact(s.StartTime, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var start) ||
                !TimeOnly.TryParseExact(s.EndTime, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
            { errors.Add($"{label}: times must look like 16:00."); continue; }
            if (end <= start) { errors.Add($"{label}: the end time must be after the start time."); continue; }
            if ((end - start).TotalMinutes < s.SlotMinutes) { errors.Add($"{label}: the session is shorter than one appointment."); continue; }

            clean.Add(new CleanSession(s.BranchId, s.Weekday, start.ToString(TimeFormat, CultureInfo.InvariantCulture), end.ToString(TimeFormat, CultureInfo.InvariantCulture), s.SlotMinutes));
        }

        // a doctor cannot be in two sessions at once on the same day, even at different branches
        foreach (var day in clean.GroupBy(c => c.Weekday))
        {
            var ordered = day.OrderBy(c => c.Start, StringComparer.Ordinal).ToList();
            for (var i = 1; i < ordered.Count; i++)
            {
                if (string.CompareOrdinal(ordered[i].Start, ordered[i - 1].End) < 0)
                    errors.Add($"Sessions overlap on weekday {day.Key} ({ordered[i - 1].Start}-{ordered[i - 1].End} and {ordered[i].Start}-{ordered[i].End}).");
            }
        }

        return (clean, leave, errors);
    }

    private record SessionDbRow(int DoctorId, int Id, int BranchId, string BranchName, int Weekday, string StartTime, string EndTime, int SlotMinutes);

    private static async Task<List<DoctorSchedule>> LoadAllAsync(NpgsqlConnection db)
    {
        var doctors = (await db.QueryAsync<DoctorScheduleRow>(@"
            SELECT id, name, specialization, room_no AS RoomNo, hospital_name AS HospitalName,
                   consultation_fee AS ConsultationFee, accepts_online_booking AS AcceptsOnlineBooking,
                   to_char(on_leave_until, 'YYYY-MM-DD') AS OnLeaveUntil
            FROM doctors ORDER BY id ASC;")).ToList();

        var sessions = (await db.QueryAsync<SessionDbRow>(@"
            SELECT s.doctor_id AS DoctorId, s.id, s.branch_id AS BranchId, b.name AS BranchName, s.weekday::int AS Weekday,
                   to_char(s.start_time, 'HH24:MI') AS StartTime, to_char(s.end_time, 'HH24:MI') AS EndTime,
                   s.slot_minutes::int AS SlotMinutes
            FROM doctor_schedules s JOIN branches b ON b.id = s.branch_id
            ORDER BY s.weekday ASC, s.start_time ASC;")).ToList();

        return doctors
            .Select(d => new DoctorSchedule(d, sessions
                .Where(s => s.DoctorId == d.Id)
                .Select(s => new SessionRow(s.Id, s.BranchId, s.BranchName, s.Weekday, s.StartTime, s.EndTime, s.SlotMinutes))
                .ToList()))
            .ToList();
    }
}
