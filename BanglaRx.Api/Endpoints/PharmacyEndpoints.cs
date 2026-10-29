using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public record DispenseLine(string? BrandName);
public record DispenseInput(List<DispenseLine>? Items, string? Note);
public class DispenseRecordView
{
    public long Id { get; set; }
    public int PrescriptionVersion { get; set; }
    public string BrandName { get; set; } = "";
    public string Strength { get; set; } = "";
    public string Form { get; set; } = "";
    public string DispensedBy { get; set; } = "";
    public DateTime DispensedAt { get; set; }
    public string? Note { get; set; }
}

public static class PharmacySchema
{
    public static async Task EnsureAsync(IDbConnectionFactory f)
    {
        try
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            // brand/strength/form are copied in, because a revised prescription replaces its lines and the hand-over must stay on record
            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS dispense_records (
                    id BIGSERIAL PRIMARY KEY,
                    prescription_id INT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
                    prescription_version INT NOT NULL,
                    brand_name VARCHAR(150) NOT NULL,
                    strength VARCHAR(50) NOT NULL DEFAULT '',
                    form VARCHAR(50) NOT NULL DEFAULT '',
                    dispensed_by VARCHAR(100) NOT NULL,
                    dispensed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    note TEXT,
                    UNIQUE (prescription_id, prescription_version, brand_name)
                );");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Pharmacy Schema Note]: {ex.Message}");
        }
    }
}

/// <summary>
/// What a pharmacist may see: signed prescriptions only, and only what is needed to hand medicines over.
/// No diagnosis, complaints, vitals, exam notes or advice ever leave through these routes.
/// </summary>
public static class PharmacyEndpoints
{
    public static void MapPharmacyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/pharmacy").WithTags("Pharmacy");

        group.MapGet("/prescriptions", async (string? q, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var term = string.IsNullOrWhiteSpace(q) ? null : $"%{q.Trim()}%";
            return Results.Ok(await db.QueryAsync<dynamic>(@"
                SELECT p.id, p.rx_number, p.is_signed, p.version, p.created_at,
                       pt.full_name AS patient_name, d.name AS doctor_name,
                       (SELECT count(*) FROM prescription_items i WHERE i.prescription_id = p.id) AS item_count,
                       (SELECT count(*) FROM dispense_records r WHERE r.prescription_id = p.id AND r.prescription_version = p.version) AS dispensed_count
                FROM prescriptions p
                JOIN patients pt ON pt.id = p.patient_id
                JOIN doctors d ON d.id = p.doctor_id
                WHERE p.is_signed AND (@term IS NULL OR p.rx_number ILIKE @term OR pt.full_name ILIKE @term)
                ORDER BY p.id DESC LIMIT 20;", new { term }));
        });

        group.MapGet("/prescriptions/{id:int}", async (int id, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var rx = await db.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT p.id, p.rx_number, p.is_signed, p.version, p.created_at,
                       d.name AS doctor_name, d.specialization AS doctor_specialization,
                       pt.full_name AS patient_name, pt.age AS patient_age, pt.gender AS patient_gender,
                       pt.blood_group AS patient_blood_group, pt.allergies AS patient_allergies
                FROM prescriptions p
                JOIN doctors d ON d.id = p.doctor_id
                JOIN patients pt ON pt.id = p.patient_id
                WHERE p.id = @id AND p.is_signed;", new { id });
            if (rx is null) return Results.NotFound(new { errors = new[] { "No signed prescription with that number." } });

            var items = await db.QueryAsync<PrescriptionItem>("SELECT * FROM prescription_items WHERE prescription_id = @id ORDER BY id ASC;", new { id });
            var records = (await db.QueryAsync<DispenseRecordView>(@"
                SELECT id AS Id, prescription_version AS PrescriptionVersion, brand_name AS BrandName, strength AS Strength, form AS Form,
                       dispensed_by AS DispensedBy, dispensed_at AS DispensedAt, note AS Note
                FROM dispense_records WHERE prescription_id = @id ORDER BY id;", new { id })).ToList();
            int current = (int)rx.version;
            return Results.Ok(new
            {
                Prescription = rx,
                Items = items,
                Dispensed = records,
                // true when some medicines were handed over under an older version and the doctor has changed the prescription since
                RevisedAfterDispense = records.Any(r => r.PrescriptionVersion < current),
            });
        });

        // Hand over: one record per medicine line per prescription version. Safe to send twice.
        group.MapPost("/prescriptions/{id:int}/dispense", async (int id, DispenseInput req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var wanted = (req.Items ?? new()).Where(i => !string.IsNullOrWhiteSpace(i.BrandName)).ToList();
            if (wanted.Count == 0) return Results.BadRequest(new { errors = new[] { "Tick at least one medicine." } });
            var who = ctx.User.FindFirst("unique_name")?.Value ?? ctx.User.Identity?.Name ?? "Pharmacy";
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var version = await db.QueryFirstOrDefaultAsync<int?>("SELECT version FROM prescriptions WHERE id = @id AND is_signed;", new { id });
            if (version is null) return Results.NotFound(new { errors = new[] { "No signed prescription with that number." } });
            var lines = (await db.QueryAsync<(string BrandName, string Strength, string Form)>(
                "SELECT brand_name, strength, form FROM prescription_items WHERE prescription_id = @id;", new { id })).ToList();
            var added = 0;
            foreach (var w in wanted)
            {
                var line = lines.FirstOrDefault(l => string.Equals(l.BrandName, w.BrandName, StringComparison.OrdinalIgnoreCase));
                if (line.BrandName is null) return Results.BadRequest(new { errors = new[] { $"{w.BrandName} is not on this prescription." } });
                added += await db.ExecuteAsync(@"
                    INSERT INTO dispense_records (prescription_id, prescription_version, brand_name, strength, form, dispensed_by, note)
                    VALUES (@id, @version, @brand, @strength, @form, @who, @note)
                    ON CONFLICT (prescription_id, prescription_version, brand_name) DO NOTHING;",
                    new { id, version, brand = line.BrandName, strength = line.Strength, form = line.Form, who, note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim() });
            }
            return Results.Ok(new { recorded = added, version });
        });

        // Undo a tick made by mistake: only within 15 minutes.
        group.MapDelete("/dispense/{recordId:long}", async (long recordId, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var n = await db.ExecuteAsync("DELETE FROM dispense_records WHERE id = @recordId AND dispensed_at > now() - interval '15 minutes';", new { recordId });
            return n == 0
                ? Results.Json(new { errors = new[] { "That record is older than 15 minutes (or does not exist), so it can no longer be undone." } }, statusCode: 409)
                : Results.Ok(new { undone = true });
        });
    }
}
