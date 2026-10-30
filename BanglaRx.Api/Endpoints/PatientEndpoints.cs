using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using BanglaRx.Api.Models.DTOs;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class PatientEndpoints
{
    public static void MapPatientEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/patients").WithTags("Patients");

        group.MapGet("/", async (IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var patients = await db.QueryAsync<Patient>("SELECT * FROM patients ORDER BY id ASC;");
            return Results.Ok(patients);
        });

        // Is the doctor allowed to record this patient's visit? agreed / declined / not_asked (no app account or no answer).
        // Declined wins: if anyone with this patient on their account said no, we do not record.
        group.MapGet("/{id:int}/consent", async (int id, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var answers = (await db.QueryAsync<bool?>(@"
                SELECT c.record_visit FROM patient_account_profiles l
                JOIN patient_consents c ON c.account_id = l.account_id
                WHERE l.patient_id = @id;", new { id })).ToList();
            var status = answers.Any(a => a == false) ? "declined" : answers.Any(a => a == true) ? "agreed" : "not_asked";
            return Results.Ok(new { recordVisit = status });
        });

        // Reports the patient photographed, checked and confirmed themselves. Never a lab result: the doctor must still verify.
        group.MapGet("/{id:int}/reports", async (int id, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var rows = await db.QueryAsync(@"
                SELECT id, kind, to_char(taken_on, 'YYYY-MM-DD') AS taken_on, created_at, report_values::text AS vals
                FROM patient_reports WHERE patient_id = @id ORDER BY COALESCE(taken_on, created_at::date) DESC, id DESC LIMIT 20;", new { id });
            return Results.Ok(rows.Select(r => new
            {
                id = (long)r.id, kind = (string)r.kind, takenOn = (string?)r.taken_on,
                createdAt = (DateTime)r.created_at, values = System.Text.Json.JsonDocument.Parse((string)r.vals).RootElement,
                source = "patient_confirmed_ai_read",
            }));
        });

        group.MapPost("/", async (CreatePatientRequest req, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var count = await db.ExecuteScalarAsync<int>("SELECT count(*) FROM patients;");
            var uid = $"PAT-2026-{(count + 1):D4}";

            var sql = @"
                INSERT INTO patients (patient_uid, full_name, age, gender, phone, blood_group, allergies, chronic_conditions)
                VALUES (@uid, @FullName, @Age, @Gender, @Phone, @BloodGroup, @Allergies, @ChronicConditions)
                RETURNING id;";

            var newId = await db.QuerySingleAsync<int>(sql, new
            {
                uid,
                req.FullName,
                req.Age,
                req.Gender,
                req.Phone,
                req.BloodGroup,
                Allergies = string.IsNullOrWhiteSpace(req.Allergies) ? "Not recorded" : req.Allergies,
                ChronicConditions = string.IsNullOrWhiteSpace(req.ChronicConditions) ? "Not recorded" : req.ChronicConditions
            });

            var created = await db.QuerySingleAsync<Patient>("SELECT * FROM patients WHERE id = @newId;", new { newId });
            return Results.Ok(created);
        });
    }
}
