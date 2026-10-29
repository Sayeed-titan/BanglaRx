using System.Globalization;
using BanglaRx.Api.Booking;
using BanglaRx.Api.Data;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.PatientApp;

public record PhoneInput(string? Phone);
public record VerifyInput(string? Phone, string? Code);
public record ProfileInput(string? FullName, int? Age, string? Gender);
public record PatientBookingInput(int? DoctorId, string? Date, string? Time, int? ProfileId, string? Reason, string? Channel);

public record ProfileView(int Id, string FullName, int Age, string Gender, string PatientUid, string Link);
public record PatientBookingView(BookingView Booking, bool CanCancel);

/// <summary>
/// What a patient can do for themselves and their family. Everything here needs a patient token, and
/// only ever reaches the people linked to that phone number.
/// </summary>
public static class PatientAppEndpoints
{
    private const string AccountItem = "rx.patient";
    private static readonly string[] Channels = { "app", "web", "whatsapp" };

    private static PatientAccount Me(HttpContext ctx) => (PatientAccount)ctx.Items[AccountItem]!;

    private static IResult Fail(int status, string message) => Results.Json(new { errors = new[] { message } }, statusCode: status);

    /// <summary>Showcase mode only (Sms:Provider = demo): the code just sent, so the screen can show it. Null otherwise.</summary>
    private static string? DemoCode(SmsOptions sms, string phone) =>
        sms.Provider.Equals("demo", StringComparison.OrdinalIgnoreCase) && DemoSmsSender.Last.TryGetValue(phone, out var m)
            ? System.Text.RegularExpressions.Regex.Match(m, @"\d{6}").Value : null;

    public static void MapPatientAppEndpoints(this IEndpointRouteBuilder app)
    {
        // ---- signing in (no token needed) ----
        var auth = app.MapGroup("/api/patient/auth").WithTags("Patient sign-in");

        auth.MapPost("/request-code", async (PhoneInput req, HttpContext ctx, IDbConnectionFactory f, PatientAuthService svc, SmsOptions sms) =>
        {
            var phone = Phones.Normalize(req.Phone);
            if (phone is null) return Fail(400, "Enter a Bangladesh mobile number, like 01712345678.");
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var result = await svc.RequestCodeAsync(db, phone, ip);
            await Audit(db, ip, phone, result == 200 ? "patient_code_sent" : result == 429 ? "patient_code_limited" : "patient_code_send_failed");
            return result switch
            {
                200 => Results.Ok(new { sent = true, expiresInSeconds = svc.Options.OtpSeconds, demoCode = DemoCode(sms, phone) }),
                429 => Fail(429, "Too many codes were asked for. Please wait a few minutes and try again."),
                _ => Fail(503, "We couldn't send the code right now. Please try again in a moment."),
            };
        });

        auth.MapPost("/verify", async (VerifyInput req, HttpContext ctx, IDbConnectionFactory f, PatientAuthService svc) =>
        {
            var phone = Phones.Normalize(req.Phone);
            const string wrong = "That code is not right, or it has expired. Ask for a new one.";
            if (phone is null) return Fail(401, wrong);
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            if (!await svc.VerifyCodeAsync(db, phone, req.Code))
            {
                await Audit(db, ip, phone, "patient_code_wrong");
                return Fail(401, wrong);
            }

            var acc = await db.QueryFirstAsync<(int Id, bool Active, int Version)>(@"
                INSERT INTO patient_accounts (phone, last_login_at) VALUES (@phone, now())
                ON CONFLICT (phone) DO UPDATE SET last_login_at = now()
                RETURNING id AS Id, is_active AS Active, token_version AS Version;", new { phone });
            if (!acc.Active) return Fail(403, "This account has been switched off. Please call the clinic.");

            // The verified phone is the proof: patient records the clinic already holds under this number become theirs to manage.
            await db.ExecuteAsync(@"
                INSERT INTO patient_account_profiles (account_id, patient_id, link)
                SELECT @id, p.id, 'phone_match' FROM patients p
                WHERE right(regexp_replace(p.phone, '\D', '', 'g'), 10) = @last10
                ON CONFLICT DO NOTHING;", new { id = acc.Id, last10 = Phones.Last10(phone) });

            var (token, expires) = svc.CreateToken(acc.Id, acc.Version);
            await Audit(db, ip, phone, "patient_login");
            return Results.Ok(new { token, expiresAt = expires, phone, profiles = await Profiles(db, acc.Id) });
        });

        // ---- everything below needs a patient token ----
        var g = app.MapGroup("/api/patient").WithTags("Patient app");
        g.AddEndpointFilter(async (ctx, next) =>
        {
            var http = ctx.HttpContext;
            var svc = http.RequestServices.GetRequiredService<PatientAuthService>();
            var acc = await svc.ValidateAsync(http.Request.Headers.Authorization.ToString(), http.RequestServices.GetRequiredService<IDbConnectionFactory>());
            if (acc is null) return Fail(401, "Please sign in again.");
            http.Items[AccountItem] = acc;
            return await next(ctx);
        });

        g.MapPost("/auth/logout", async (HttpContext ctx, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            await db.ExecuteAsync("UPDATE patient_accounts SET token_version = token_version + 1 WHERE id = @id;", new { id = Me(ctx).Id });
            return Results.NoContent();
        });

        g.MapGet("/me", async (HttpContext ctx, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            return Results.Ok(new { phone = Me(ctx).Phone, profiles = await Profiles(db, Me(ctx).Id) });
        });

        // add a family member under this phone number
        g.MapPost("/profiles", async (ProfileInput req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var errors = new List<string>();
            if (string.IsNullOrWhiteSpace(req.FullName) || req.FullName.Trim().Length > 150) errors.Add("Enter the person's name.");
            if (req.Age is null or < 0 or > 120) errors.Add("The age must be between 0 and 120.");
            if (req.Gender is not ("Male" or "Female" or "Other")) errors.Add("Choose Male, Female or Other.");
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            using var db = f.CreateConnection();
            await db.OpenAsync();
            var account = Me(ctx);
            if (await db.ExecuteScalarAsync<int>("SELECT count(*) FROM patient_account_profiles WHERE account_id = @id;", new { id = account.Id }) >= 10)
                return Fail(400, "An account can hold up to 10 people.");

            await using var tx = await db.BeginTransactionAsync();
            var newId = await db.ExecuteScalarAsync<int>("SELECT nextval(pg_get_serial_sequence('patients', 'id'));", transaction: tx);
            await db.ExecuteAsync(@"
                INSERT INTO patients (id, patient_uid, full_name, age, gender, phone, blood_group, allergies, chronic_conditions)
                VALUES (@newId, @uid, @name, @age, @gender, @phone, 'Unknown', 'Not recorded', 'Not recorded');
                INSERT INTO patient_account_profiles (account_id, patient_id, link) VALUES (@account, @newId, 'added_by_patient');",
                new { newId, uid = $"PAT-2026-{newId:D4}", name = req.FullName!.Trim(), age = req.Age, gender = req.Gender, phone = account.Phone, account = account.Id }, tx);
            await tx.CommitAsync();
            return Results.Ok(new { profiles = await Profiles(db, account.Id) });
        });

        // ---- finding a doctor and a time ----
        g.MapGet("/doctors", async (IDbConnectionFactory f, ClinicClock clock) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var docs = (await db.QueryAsync<DoctorCard>(@"
                SELECT d.id AS Id, d.name AS Name, d.degrees AS Degrees, d.specialization AS Specialization, d.hospital_name AS HospitalName,
                       d.consultation_fee AS ConsultationFee
                FROM doctors d
                WHERE d.accepts_online_booking AND EXISTS (SELECT 1 FROM doctor_schedules s WHERE s.doctor_id = d.id)
                ORDER BY d.name;")).ToList();
            var result = new List<object>();
            foreach (var d in docs)
            {
                SlotInfo? next = null;
                string? nextDate = null;
                for (var i = 0; i <= clock.Options.MaxDaysAhead && next is null; i++)
                {
                    var day = await SlotService.BuildAsync(db, clock, d.Id, clock.Today.AddDays(i));
                    next = day.Slots.FirstOrDefault(s => s.State == "open");
                    if (next is not null) nextDate = day.Date;
                }
                result.Add(new { d.Id, d.Name, d.Degrees, d.Specialization, d.HospitalName, d.ConsultationFee, nextFree = next is null ? null : new { date = nextDate, time = next.Time, branch = next.BranchName } });
            }
            return Results.Ok(result);
        });

        g.MapGet("/slots", async (int doctorId, string date, IDbConnectionFactory f, ClinicClock clock) =>
        {
            if (!BookingEndpoints.TryDate(date, out var d)) return Fail(400, "The date must look like 2026-11-02.");
            using var db = f.CreateConnection();
            await db.OpenAsync();
            if (!await db.ExecuteScalarAsync<bool>("SELECT accepts_online_booking FROM doctors WHERE id = @doctorId;", new { doctorId }))
                return Fail(404, "This doctor does not take online bookings.");
            var day = await SlotService.BuildAsync(db, clock, doctorId, d);
            // a patient sees only what they can book: no other patient's name, no taken times
            return Results.Ok(day with { Slots = day.Slots.Where(s => s.State == "open").Select(s => s with { BookingId = null }).ToList() });
        });

        // ---- bookings ----
        g.MapGet("/bookings", async (HttpContext ctx, IDbConnectionFactory f, ClinicClock clock, PatientAuthService svc) =>
        {
            using var db = f.CreateConnection();
            var rows = await db.QueryAsync<BookingView>($@"{BookingEndpoints.View}
                WHERE b.patient_id IN (SELECT patient_id FROM patient_account_profiles WHERE account_id = @id)
                ORDER BY b.slot_date DESC, b.slot_time DESC LIMIT 60;", new { id = Me(ctx).Id });
            return Results.Ok(rows.Select(b => new PatientBookingView(b, CanCancel(b, clock, svc.Options))));
        });

        g.MapPost("/bookings", async (PatientBookingInput req, HttpContext ctx, IDbConnectionFactory f, ClinicClock clock, PatientAuthService svc) =>
        {
            var channel = (req.Channel ?? "app").Trim().ToLowerInvariant();
            if (!Channels.Contains(channel)) return Fail(400, "Unknown way of booking.");
            if (req.ProfileId is null) return Fail(400, "Choose who the appointment is for.");

            using var db = f.CreateConnection();
            await db.OpenAsync();
            var account = Me(ctx);
            if (!await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM patient_account_profiles WHERE account_id = @a AND patient_id = @p);", new { a = account.Id, p = req.ProfileId }))
                return Fail(403, "That person is not on your account.");

            var live = await db.ExecuteScalarAsync<int>(@"
                SELECT count(*) FROM bookings b JOIN patient_account_profiles l ON l.patient_id = b.patient_id AND l.account_id = @a
                WHERE b.status = 'booked' AND b.slot_date >= @today::date;", new { a = account.Id, today = clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) });
            if (live >= svc.Options.MaxLiveBookings) return Fail(400, $"You already have {live} upcoming appointments. Cancel one, or call the clinic, to book more.");

            return await BookingEndpoints.CreateAsync(new BookingInput(req.DoctorId, req.Date, req.Time, req.ProfileId, null, req.Reason, channel), null, f, clock);
        });

        g.MapPost("/bookings/{id:int}/cancel", async (int id, HttpContext ctx, IDbConnectionFactory f, ClinicClock clock, PatientAuthService svc) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var b = await db.QueryFirstOrDefaultAsync<BookingView>($@"{BookingEndpoints.View}
                WHERE b.id = @id AND b.patient_id IN (SELECT patient_id FROM patient_account_profiles WHERE account_id = @a);", new { id, a = Me(ctx).Id });
            if (b is null) return Fail(404, "Booking not found.");
            if (b.Status != "booked") return Fail(409, "Only a booked appointment can be cancelled.");
            if (!CanCancel(b, clock, svc.Options))
                return Fail(400, $"It is too close to the appointment time to cancel here. Please call the clinic.");
            await db.ExecuteAsync("UPDATE bookings SET status = 'cancelled', cancelled_at = now(), updated_at = now(), cancel_reason = 'Cancelled by the patient' WHERE id = @id AND status = 'booked';", new { id });
            return Results.Ok(await BookingEndpoints.Load(db, id));
        });

        // Where am I in today's line? Counts only: how long it will take is not measured, so none is promised.
        g.MapGet("/queue", async (HttpContext ctx, IDbConnectionFactory f, ClinicClock clock) =>
        {
            using var db = f.CreateConnection();
            var rows = await db.QueryAsync<QueuePosition>(@"
                SELECT b.id AS BookingId, p.full_name AS PatientName, d.name AS DoctorName, a.token_number AS Token,
                       (SELECT min(x.token_number) FROM appointments x WHERE x.doctor_id = a.doctor_id AND x.status = 'In Consultation'
                          AND ((x.created_at AT TIME ZONE 'UTC') + (@off * interval '1 hour'))::date = ((a.created_at AT TIME ZONE 'UTC') + (@off * interval '1 hour'))::date) AS NowServing,
                       (SELECT count(*) FROM appointments x WHERE x.doctor_id = a.doctor_id AND x.status = 'Waiting' AND x.token_number < a.token_number
                          AND ((x.created_at AT TIME ZONE 'UTC') + (@off * interval '1 hour'))::date = ((a.created_at AT TIME ZONE 'UTC') + (@off * interval '1 hour'))::date)::int AS Ahead,
                       a.status AS Status
                FROM bookings b
                JOIN appointments a ON a.id = b.appointment_id
                JOIN patients p ON p.id = b.patient_id
                JOIN doctors d ON d.id = b.doctor_id
                WHERE b.patient_id IN (SELECT patient_id FROM patient_account_profiles WHERE account_id = @id)
                  AND b.status = 'arrived' AND b.slot_date = @today::date AND a.status <> 'Completed';",
                new { id = Me(ctx).Id, off = clock.Options.UtcOffsetHours, today = clock.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) });
            return Results.Ok(rows);
        });
    }

    private record DoctorCard(int Id, string Name, string Degrees, string Specialization, string HospitalName, decimal? ConsultationFee);
    private record QueuePosition(int BookingId, string PatientName, string DoctorName, int Token, int? NowServing, int Ahead, string Status);

    private static bool CanCancel(BookingView b, ClinicClock clock, PatientOptions o)
    {
        if (b.Status != "booked") return false;
        var start = DateTime.ParseExact($"{b.Date} {b.Time}", "yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
        return start - clock.Now >= TimeSpan.FromHours(o.CancelHoursBefore);
    }

    private static Task<IEnumerable<ProfileView>> Profiles(NpgsqlConnection db, int accountId) =>
        db.QueryAsync<ProfileView>(@"
            SELECT p.id AS Id, p.full_name AS FullName, p.age AS Age, p.gender AS Gender, p.patient_uid AS PatientUid, l.link AS Link
            FROM patient_account_profiles l JOIN patients p ON p.id = l.patient_id
            WHERE l.account_id = @accountId ORDER BY p.id;", new { accountId });

    private static Task Audit(NpgsqlConnection db, string? ip, string phone, string eventName) =>
        db.ExecuteAsync("INSERT INTO auth_events (username, event, ip) VALUES (@who, @eventName, @ip);", new { who = Phones.Mask(phone), eventName, ip });
}
