using System.Text.Json;
using BanglaRx.Api.Data;
using BanglaRx.Api.Models.DTOs;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class QueueEndpoints
{
    public static void MapQueueEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/queue").WithTags("Queue");

        group.MapGet("/", async (int? doctorId, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var query = @"
                SELECT 
                    a.id, a.token_number, a.doctor_id, a.patient_id, a.status, a.triage_vitals, a.chief_complaint, a.created_at,
                    p.full_name as patient_name, p.age as patient_age, p.gender as patient_gender,
                    p.phone as patient_phone, p.blood_group as patient_blood_group,
                    p.allergies as patient_allergies, p.chronic_conditions as patient_chronic,
                    p.patient_uid
                FROM appointments a
                JOIN patients p ON a.patient_id = p.id
                WHERE (@doctorId IS NULL OR a.doctor_id = @doctorId)
                ORDER BY a.token_number ASC;";
            var queue = await db.QueryAsync<dynamic>(query, new { doctorId });
            return Results.Ok(queue);
        });

        group.MapPost("/", async (AddToQueueRequest req, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var maxToken = await db.ExecuteScalarAsync<int?>(
                "SELECT MAX(token_number) FROM appointments WHERE doctor_id = @DoctorId;", 
                new { req.DoctorId }) ?? 0;
            var nextToken = maxToken + 1;

            var vitalsJson = JsonSerializer.Serialize(req.TriageVitals ?? new Dictionary<string, string>());
            var sql = @"
                INSERT INTO appointments (token_number, doctor_id, patient_id, status, triage_vitals, chief_complaint)
                VALUES (@nextToken, @DoctorId, @PatientId, 'Waiting', @vitalsJson::jsonb, @ChiefComplaint)
                RETURNING id;";
            
            var newId = await db.QuerySingleAsync<int>(sql, new
            {
                nextToken,
                req.DoctorId,
                req.PatientId,
                vitalsJson,
                req.ChiefComplaint
            });

            return Results.Ok(new { Id = newId, TokenNumber = nextToken, Status = "Waiting" });
        });

        group.MapPatch("/{id:int}/status", async (int id, UpdateQueueStatusRequest req, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            await db.ExecuteAsync("UPDATE appointments SET status = @Status WHERE id = @id;", new { req.Status, id });
            return Results.Ok(new { Success = true, Id = id, Status = req.Status });
        });
    }
}
