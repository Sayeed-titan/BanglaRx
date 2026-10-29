using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using BanglaRx.Api.Models.DTOs;
using BanglaRx.Api.Services;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class InteractionEndpoints
{
    public static void MapInteractionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/interactions").WithTags("Interactions");

        group.MapPost("/check", async (CheckInteractionsRequest req, IDrugSafetyService drugSafetyService) =>
        {
            if (req.GenericNames == null || req.GenericNames.Count < 2)
            {
                return Results.Ok(new { HasInteractions = false, Warnings = new List<dynamic>() });
            }

            var warnings = await drugSafetyService.CheckInteractionsAsync(req.GenericNames);

            return Results.Ok(new
            {
                HasInteractions = warnings.Count > 0,
                TotalWarnings = warnings.Count,
                Warnings = warnings
            });
        });

        // Full prescription safety check: allergy + duplicate + interaction + dose (patient data read from DB when PatientId is given)
        app.MapPost("/api/safety/check", async (SafetyCheckRequest req, IClinicalSafetyService safety, IDbConnectionFactory connectionFactory) =>
        {
            if (req.PatientId.HasValue)
            {
                using var db = connectionFactory.CreateConnection();
                var p = await db.QuerySingleOrDefaultAsync<Patient>("SELECT * FROM patients WHERE id = @id;", new { id = req.PatientId });
                if (p != null)
                {
                    req.Allergies = string.IsNullOrWhiteSpace(req.Allergies) ? p.allergies : req.Allergies;
                    req.Age ??= p.age;
                }
            }

            var alerts = await safety.CheckAsync(req);
            return Results.Ok(new { Alerts = alerts, Count = alerts.Count });
        }).WithTags("Safety");
    }
}
