using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using Dapper;

namespace BanglaRx.Api.Endpoints;

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
                       pt.full_name AS patient_name, d.name AS doctor_name
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
            return Results.Ok(new { Prescription = rx, Items = items });
        });
    }
}
