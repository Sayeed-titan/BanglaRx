using System.Globalization;
using BanglaRx.Api.Auth;
using BanglaRx.Api.Data;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.Booking;

public record NewPatientInput(string? FullName, int? Age, string? Gender, string? Phone);
public record BookingInput(int? DoctorId, string? Date, string? Time, int? PatientId, NewPatientInput? NewPatient, string? Reason, string? Source);
public record CancelInput(string? Reason);
public record MoveInput(string? Date, string? Time);

public record BookingView(
    int Id, int DoctorId, string DoctorName, int BranchId, string BranchName, int PatientId, string PatientName, string? PatientPhone,
    string Date, string Time, int Minutes, string Status, string Source, string? Reason, int? AppointmentId, int? TokenNumber, string? CancelReason);

/// <summary>
/// Staff-side booking: find open slots, book, move, cancel, check in, mark no-show.
/// Patient-facing booking (Rubina, the app) will call the same rules once patients can sign in.
/// </summary>
public static class BookingEndpoints
{
    public const string View = @"
        SELECT b.id, b.doctor_id AS DoctorId, d.name AS DoctorName, b.branch_id AS BranchId, br.name AS BranchName,
               b.patient_id AS PatientId, p.full_name AS PatientName, p.phone AS PatientPhone,
               to_char(b.slot_date, 'YYYY-MM-DD') AS Date, to_char(b.slot_time, 'HH24:MI') AS Time, b.slot_minutes::int AS Minutes,
               b.status, b.source, b.reason, b.appointment_id AS AppointmentId, a.token_number AS TokenNumber, b.cancel_reason AS CancelReason
        FROM bookings b
        JOIN doctors d ON d.id = b.doctor_id
        JOIN branches br ON br.id = b.branch_id
        JOIN patients p ON p.id = b.patient_id
        LEFT JOIN appointments a ON a.id = b.appointment_id";

    public static void MapBookingEndpoints(this IEndpointRouteBuilder app)
    {
        // Every grid time for a doctor on a date, each marked open, booked or closed (past or too soon)
        app.MapGet("/api/slots", async (int doctorId, string date, bool? onlyOpen, IDbConnectionFactory f, ClinicClock clock) =>
        {
            if (!TryDate(date, out var d)) return Results.BadRequest(new { errors = new[] { "The date must look like 2026-11-02." } });
            using var db = f.CreateConnection();
            await db.OpenAsync();
            if (!await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM doctors WHERE id = @doctorId);", new { doctorId }))
                return Results.NotFound(new { errors = new[] { "Doctor not found." } });
            var day = await SlotService.BuildAsync(db, clock, doctorId, d);
            return Results.Ok(onlyOpen == true ? day with { Slots = day.Slots.Where(s => s.State == "open").ToList() } : day);
        });

        // The clinic's own date and time, so a screen in another time zone never disagrees with the server about "today"
        app.MapGet("/api/booking/info", (ClinicClock clock) => Results.Ok(new
        {
            today = clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            now = clock.Now.ToString("HH:mm", CultureInfo.InvariantCulture),
            maxDaysAhead = clock.Options.MaxDaysAhead,
            minLeadMinutes = clock.Options.MinLeadMinutes,
        }));

        var g = app.MapGroup("/api/bookings").WithTags("Bookings");

        g.MapGet("/", async (string? date, int? doctorId, string? status, int? patientId, IDbConnectionFactory f, ClinicClock clock) =>
        {
            if (date is not null && !TryDate(date, out _)) return Results.BadRequest(new { errors = new[] { "The date must look like 2026-11-02." } });
            using var db = f.CreateConnection();
            var day = date ?? (patientId is null ? clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) : null);
            var rows = await db.QueryAsync<BookingView>($@"{View}
                WHERE (@day::date IS NULL OR b.slot_date = @day::date) AND (@doctorId::int IS NULL OR b.doctor_id = @doctorId)
                  AND (@status::text IS NULL OR b.status = @status) AND (@patientId::int IS NULL OR b.patient_id = @patientId)
                ORDER BY b.slot_date, b.slot_time LIMIT 300;", new { day, doctorId, status, patientId });
            return Results.Ok(rows);
        });

        g.MapPost("/", (BookingInput req, HttpContext ctx, IDbConnectionFactory f, ClinicClock clock) => CreateAsync(req, ctx.GetUser()?.Id, f, clock));

        g.MapPost("/{id:int}/cancel", async (int id, CancelInput req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var n = await db.ExecuteAsync(@"
                UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now(), cancelled_by = @by, cancel_reason = @reason
                WHERE id = @id AND status = 'booked';", new { id, by = ctx.GetUser()?.Id, reason = req.Reason?.Trim() });
            if (n == 1) return Results.Ok(await Load(db, id));
            return await WhyNot(db, id, "Only a booked appointment can be cancelled.");
        });

        g.MapPut("/{id:int}/move", async (int id, MoveInput req, IDbConnectionFactory f, ClinicClock clock) =>
        {
            if (!TryDate(req.Date, out var date) || !TryTime(req.Time, out var time)) return Results.BadRequest(new { errors = new[] { "Give a date like 2026-11-02 and a time like 16:30." } });
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var current = await Load(db, id);
            if (current is null) return Results.NotFound(new { errors = new[] { "Booking not found." } });
            if (current.Status != "booked") return Results.Conflict(new { errors = new[] { "Only a booked appointment can be moved." } });

            using var tx = await db.BeginTransactionAsync();
            try
            {
                var day = await SlotService.BuildAsync(db, clock, current.DoctorId, date, tx);
                var label = time.ToString("HH:mm", CultureInfo.InvariantCulture);
                var slot = day.Slots.FirstOrDefault(s => s.Time == label);
                if (slot is null) return Results.BadRequest(new { errors = new[] { day.Note ?? "That time is not on this doctor's schedule." } });
                if (slot.State == "booked") return Results.Conflict(new { errors = new[] { "That time is already booked." } });
                if (slot.State == "closed") return Results.BadRequest(new { errors = new[] { "That time has passed or is too soon to book." } });

                await db.ExecuteAsync(@"
                    UPDATE bookings SET slot_date = @date::date, slot_time = @time::time, slot_minutes = @minutes, branch_id = @branchId, updated_at = now()
                    WHERE id = @id;", new { id, date = day.Date, time = label, minutes = (short)slot.Minutes, branchId = slot.BranchId }, tx);
                await tx.CommitAsync();
                return Results.Ok(await Load(db, id));
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { errors = new[] { "That time was just taken by someone else. Choose another." } });
            }
        });

        // The patient has arrived: the booking becomes a real token in the doctor's queue.
        g.MapPost("/{id:int}/arrive", async (int id, IDbConnectionFactory f, ClinicClock clock) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var b = await Load(db, id);
            if (b is null) return Results.NotFound(new { errors = new[] { "Booking not found." } });
            if (b.Status != "booked") return Results.Conflict(new { errors = new[] { "Only a booked appointment can be checked in." } });
            if (b.Date != clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                return Results.BadRequest(new { errors = new[] { "Only today's bookings can be checked in." } });

            using var tx = await db.BeginTransactionAsync();
            // one token at a time per doctor, so two check-ins can never share a number
            await db.ExecuteAsync("SELECT pg_advisory_xact_lock(@key);", new { key = (long)b.DoctorId }, tx);
            var token = (await db.ExecuteScalarAsync<int?>("SELECT MAX(token_number) FROM appointments WHERE doctor_id = @d;", new { d = b.DoctorId }, tx) ?? 0) + 1;
            var appointmentId = await db.ExecuteScalarAsync<int>(@"
                INSERT INTO appointments (token_number, doctor_id, patient_id, status, triage_vitals, chief_complaint)
                VALUES (@token, @d, @p, 'Waiting', '{}'::jsonb, @cc) RETURNING id;",
                new { token, d = b.DoctorId, p = b.PatientId, cc = string.IsNullOrWhiteSpace(b.Reason) ? "General Consultation" : b.Reason }, tx);
            var n = await db.ExecuteAsync("UPDATE bookings SET status = 'arrived', appointment_id = @appointmentId, updated_at = now() WHERE id = @id AND status = 'booked';", new { id, appointmentId }, tx);
            if (n != 1) { await tx.RollbackAsync(); return Results.Conflict(new { errors = new[] { "This booking was changed by someone else." } }); }
            await tx.CommitAsync();
            return Results.Ok(await Load(db, id));
        });

        g.MapPost("/{id:int}/no-show", async (int id, IDbConnectionFactory f, ClinicClock clock) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var b = await Load(db, id);
            if (b is null) return Results.NotFound(new { errors = new[] { "Booking not found." } });
            if (b.Status != "booked") return Results.Conflict(new { errors = new[] { "Only a booked appointment can be marked as a no-show." } });
            var start = DateTime.ParseExact($"{b.Date} {b.Time}", "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
            if (start > clock.Now) return Results.BadRequest(new { errors = new[] { "Wait until the appointment time has passed." } });
            await db.ExecuteAsync("UPDATE bookings SET status = 'no_show', updated_at = now() WHERE id = @id AND status = 'booked';", new { id });
            return Results.Ok(await Load(db, id));
        });
    }

    /// <summary>The single set of booking rules. The desk (staff) and the patient app both come through here.</summary>
    public static async Task<IResult> CreateAsync(BookingInput req, int? createdBy, IDbConnectionFactory f, ClinicClock clock)
    {
            var errors = new List<string>();
            var source = (req.Source ?? "front_desk").Trim().ToLowerInvariant();
            if (!BookingSchema.Sources.Contains(source)) errors.Add($"The source must be one of: {string.Join(", ", BookingSchema.Sources)}.");
            if (req.DoctorId is null) errors.Add("Choose a doctor.");
            if (!TryDate(req.Date, out var date)) errors.Add("The date must look like 2026-11-02.");
            if (!TryTime(req.Time, out var time)) errors.Add("The time must look like 16:30.");
            if ((req.PatientId is null) == (req.NewPatient is null)) errors.Add("Give either an existing patient or the details of a new one, not both and not neither.");
            if (req.NewPatient is { } check)
            {
                if (string.IsNullOrWhiteSpace(check.FullName)) errors.Add("The patient's name is required.");
                if (check.Age is null or < 0 or > 120) errors.Add("The patient's age must be between 0 and 120.");
                if (check.Gender is not ("Male" or "Female" or "Other")) errors.Add("The gender must be Male, Female or Other.");
                if (string.IsNullOrWhiteSpace(check.Phone) || check.Phone.Trim().Length is < 6 or > 30) errors.Add("A phone number (6 to 30 characters) is required.");
            }
            if (req.Reason?.Length > 500) errors.Add("The reason is too long.");
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            using var db = f.CreateConnection();
            await db.OpenAsync();
            var doctor = await db.QueryFirstOrDefaultAsync<(bool Online, bool Exists)>("SELECT accepts_online_booking AS Online, TRUE AS Exists FROM doctors WHERE id = @id;", new { id = req.DoctorId });
            if (!doctor.Exists) return Results.BadRequest(new { errors = new[] { "That doctor does not exist." } });
            if (BookingSchema.OnlineSources.Contains(source) && !doctor.Online)
                return Results.BadRequest(new { errors = new[] { "This doctor does not take online bookings." } });
            if (req.PatientId is int pid && !await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM patients WHERE id = @pid);", new { pid }))
                return Results.BadRequest(new { errors = new[] { "That patient does not exist." } });

            using var tx = await db.BeginTransactionAsync();
            try
            {
                var day = await SlotService.BuildAsync(db, clock, req.DoctorId!.Value, date, tx);
                var timeLabel = time.ToString("HH:mm", CultureInfo.InvariantCulture);
                var slot = day.Slots.FirstOrDefault(s => s.Time == timeLabel);
                if (slot is null) return Results.BadRequest(new { errors = new[] { day.Note ?? "That time is not on this doctor's schedule." } });
                if (slot.State == "booked") return Results.Conflict(new { errors = new[] { "That time is already booked." } });
                if (slot.State == "closed") return Results.BadRequest(new { errors = new[] { "That time has passed or is too soon to book." } });

                var patientId = req.PatientId;
                if (patientId is null)
                {
                    var np = req.NewPatient!;
                    var newId = await db.ExecuteScalarAsync<int>("SELECT nextval(pg_get_serial_sequence('patients', 'id'));", transaction: tx);
                    patientId = await db.ExecuteScalarAsync<int>(@"
                        INSERT INTO patients (id, patient_uid, full_name, age, gender, phone, blood_group, allergies, chronic_conditions)
                        VALUES (@newId, @uid, @name, @age, @gender, @phone, 'Unknown', 'Not recorded', 'Not recorded') RETURNING id;",
                        new { newId, uid = $"PAT-2026-{newId:D4}", name = np.FullName!.Trim(), age = np.Age, gender = np.Gender, phone = np.Phone!.Trim() }, tx);
                }

                var already = await db.ExecuteScalarAsync<bool>(@"
                    SELECT EXISTS (SELECT 1 FROM bookings WHERE patient_id = @patientId AND doctor_id = @doctorId
                                   AND slot_date = @date::date AND status IN ('booked','arrived'));",
                    new { patientId, doctorId = req.DoctorId, date = day.Date }, tx);
                if (already) return Results.Conflict(new { errors = new[] { "This patient already has a booking with this doctor on that day." } });

                var id = await db.ExecuteScalarAsync<int>(@"
                    INSERT INTO bookings (doctor_id, branch_id, patient_id, slot_date, slot_time, slot_minutes, source, reason, created_by)
                    VALUES (@doctorId, @branchId, @patientId, @date::date, @time::time, @minutes, @source, @reason, @by) RETURNING id;",
                    new { doctorId = req.DoctorId, branchId = slot.BranchId, patientId, date = day.Date, time = timeLabel, minutes = (short)slot.Minutes, source, reason = req.Reason?.Trim(), by = createdBy }, tx);
                await tx.CommitAsync();
                return Results.Ok(await Load(db, id));
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                // two people chose the same slot at the same moment: the database let exactly one through
                return Results.Conflict(new { errors = new[] { "That time was just taken by someone else. Choose another." } });
            }
    }

    public static Task<BookingView?> Load(NpgsqlConnection db, int id) =>
        db.QueryFirstOrDefaultAsync<BookingView>($"{View} WHERE b.id = @id;", new { id });

    private static async Task<IResult> WhyNot(NpgsqlConnection db, int id, string notBooked)
    {
        var exists = await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM bookings WHERE id = @id);", new { id });
        return exists ? Results.Conflict(new { errors = new[] { notBooked } }) : Results.NotFound(new { errors = new[] { "Booking not found." } });
    }

    public static bool TryDate(string? s, out DateOnly d) => DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out d);
    public static bool TryTime(string? s, out TimeOnly t) => TimeOnly.TryParseExact(s, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out t);
}
