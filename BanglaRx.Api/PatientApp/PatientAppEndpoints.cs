using System.Globalization;
using BanglaRx.Api.Booking;
using BanglaRx.Api.Data;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.PatientApp;

public record PhoneInput(string? Phone);
public record VerifyInput(string? Phone, string? Code);
public record ProfileInput(string? FullName, int? Age, string? Gender);
public record NextFreeSlot(string Date, string Time, string Branch);
public record DoctorCardOut(int Id, string Name, string Degrees, string Specialization, string HospitalName, decimal? ConsultationFee, NextFreeSlot? NextFree);
public record ConsentInput(bool? RecordVisit, bool? Reminders, bool? StoreReports);
public record ConsentView(bool? RecordVisit, bool Reminders, bool StoreReports, DateTime? UpdatedAt);
public record PatientBookingInput(int? DoctorId, string? Date, string? Time, int? ProfileId, string? Reason, string? Channel);

public record ProfileView(int Id, string FullName, int Age, string Gender, string PatientUid, string Link);
public record PatientBookingView(BookingView Booking, bool CanCancel);

public class RxMedicineView
{
    public string BrandName { get; set; } = "";
    public string GenericName { get; set; } = "";
    public string Form { get; set; } = "";
    public string Strength { get; set; } = "";
    public string DosagePattern { get; set; } = "";
    public string Duration { get; set; } = "";
    public string InstructionsBangla { get; set; } = "";
    /// <summary>Other brands in our catalogue with the same ingredient, strength and form. Names only: no price is held.</summary>
    public List<string> SameIngredient { get; set; } = new();
}
public class PatientRxView
{
    public int Id { get; set; }
    public string RxNumber { get; set; } = "";
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public string DoctorName { get; set; } = "";
    public string Specialization { get; set; } = "";
    public string PatientName { get; set; } = "";
    public string? Diagnosis { get; set; }
    public string[] AdviceBangla { get; set; } = Array.Empty<string>();
    public string? FollowUp { get; set; }
    public string? ReferredTo { get; set; }
    public List<RxMedicineView> Medicines { get; set; } = new();
}

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

    /// <summary>Doctors who take online bookings and have a schedule, each with the next free time. Used by the patient app and the public chat.</summary>
    public static async Task<List<DoctorCardOut>> DoctorCardsAsync(NpgsqlConnection db, ClinicClock clock)
    {
        var docs = (await db.QueryAsync<DoctorCard>(@"
            SELECT d.id AS Id, d.name AS Name, d.degrees AS Degrees, d.specialization AS Specialization, d.hospital_name AS HospitalName,
                   d.consultation_fee AS ConsultationFee
            FROM doctors d
            WHERE d.accepts_online_booking AND EXISTS (SELECT 1 FROM doctor_schedules s WHERE s.doctor_id = d.id)
            ORDER BY d.name;")).ToList();
        var result = new List<DoctorCardOut>();
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
            result.Add(new DoctorCardOut(d.Id, d.Name, d.Degrees, d.Specialization, d.HospitalName, d.ConsultationFee, next is null ? null : new NextFreeSlot(nextDate!, next.Time, next.BranchName)));
        }
        return result;
    }

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
            return Results.Ok(await DoctorCardsAsync(db, clock));
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

        // ---- consent: what the patient allows (recording the visit, reminders, keeping reports) ----
        g.MapGet("/consent", async (HttpContext ctx, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var row = await db.QueryFirstOrDefaultAsync<ConsentView>(
                "SELECT record_visit AS RecordVisit, reminders AS Reminders, store_reports AS StoreReports, updated_at AS UpdatedAt FROM patient_consents WHERE account_id = @id;",
                new { id = Me(ctx).Id });
            return Results.Ok(row ?? new ConsentView(null, false, false, null));
        });

        g.MapPost("/consent", async (ConsentInput req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            if (req.RecordVisit is null) return Fail(400, "Please answer whether the visit may be recorded.");
            var reminders = req.Reminders ?? false;
            var reports = req.StoreReports ?? false;
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            using var db = f.CreateConnection();
            await db.OpenAsync();
            await using var tx = await db.BeginTransactionAsync();
            await db.ExecuteAsync(@"
                INSERT INTO patient_consents (account_id, record_visit, reminders, store_reports, updated_at)
                VALUES (@id, @rec, @rem, @rep, now())
                ON CONFLICT (account_id) DO UPDATE SET record_visit = @rec, reminders = @rem, store_reports = @rep, updated_at = now();",
                new { id = Me(ctx).Id, rec = req.RecordVisit, rem = reminders, rep = reports }, tx);
            await db.ExecuteAsync(
                "INSERT INTO patient_consent_log (account_id, record_visit, reminders, store_reports, ip) VALUES (@id, @rec, @rem, @rep, @ip);",
                new { id = Me(ctx).Id, rec = req.RecordVisit, rem = reminders, rep = reports, ip }, tx);
            await tx.CommitAsync();
            return Results.Ok(new ConsentView(req.RecordVisit, reminders, reports, DateTime.UtcNow));
        });

        // ---- prescriptions: what the doctor signed for the people on this account ----
        g.MapGet("/prescriptions", async (HttpContext ctx, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var list = (await db.QueryAsync<PatientRxView>(@"
                SELECT rx.id AS Id, rx.rx_number AS RxNumber, rx.version AS Version, rx.created_at AS CreatedAt,
                       d.name AS DoctorName, d.specialization AS Specialization, p.full_name AS PatientName,
                       rx.diagnosis AS Diagnosis, COALESCE(rx.advice_bangla, ARRAY[]::text[]) AS AdviceBangla,
                       rx.follow_up AS FollowUp, rx.referred_to AS ReferredTo
                FROM prescriptions rx
                JOIN doctors d ON d.id = rx.doctor_id
                JOIN patients p ON p.id = rx.patient_id
                WHERE rx.is_signed AND rx.patient_id IN (SELECT patient_id FROM patient_account_profiles WHERE account_id = @id)
                ORDER BY rx.created_at DESC LIMIT 30;", new { id = Me(ctx).Id })).ToList();
            if (list.Count == 0) return Results.Ok(list);

            var rows = await db.QueryAsync(@"
                SELECT i.prescription_id, i.medicine_id, i.brand_name, i.generic_name, i.form, i.strength,
                       i.dosage_pattern, i.duration, i.instructions_bangla
                FROM prescription_items i WHERE i.prescription_id = ANY(@ids) ORDER BY i.id;", new { ids = list.Select(x => x.Id).ToArray() });
            var byId = list.ToDictionary(x => x.Id);
            foreach (var r in rows)
            {
                var m = new RxMedicineView
                {
                    BrandName = (string)r.brand_name, GenericName = (string)r.generic_name, Form = (string)r.form, Strength = (string)r.strength,
                    DosagePattern = (string)r.dosage_pattern, Duration = (string)r.duration, InstructionsBangla = (string)r.instructions_bangla,
                };
                m.SameIngredient = (await db.QueryAsync<string>(@"
                    SELECT brand_name FROM medicines
                    WHERE is_active AND lower(generic_name) = lower(@g) AND lower(strength) = lower(@s) AND lower(form) = lower(@f)
                      AND lower(brand_name) <> lower(@b)
                    ORDER BY brand_name LIMIT 4;", new { g = m.GenericName, s = m.Strength, f = m.Form, b = m.BrandName })).ToList();
                byId[(int)r.prescription_id].Medicines.Add(m);
            }
            return Results.Ok(list);
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
