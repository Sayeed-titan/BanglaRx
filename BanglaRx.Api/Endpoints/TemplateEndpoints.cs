using System.Text.Json;
using BanglaRx.Api.Data;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public class SaveTemplateRequest
{
    public int DoctorId { get; set; }
    public string Name { get; set; } = "";
    public JsonElement Payload { get; set; }
}

/// <summary>Doctor-owned prescription templates ("Viral fever", "UTI"...): one click fills meds, tests, advice.</summary>
public static class TemplateEndpoints
{
    public static void MapTemplateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/templates").WithTags("Templates");

        group.MapGet("/", async (int doctorId, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var rows = await db.QueryAsync<(int id, string name, string payload)>(
                "SELECT id, name, payload::text AS payload FROM rx_templates WHERE doctor_id = @doctorId ORDER BY name;", new { doctorId });
            return Results.Ok(rows.Select(r => new { r.id, r.name, payload = JsonDocument.Parse(r.payload).RootElement }));
        });

        // Same name for the same doctor overwrites (so "save again" updates the template)
        group.MapPost("/", async (SaveTemplateRequest req, IDbConnectionFactory connectionFactory) =>
        {
            if (string.IsNullOrWhiteSpace(req.Name)) return Results.BadRequest(new { Message = "Template name is required" });
            using var db = connectionFactory.CreateConnection();
            var id = await db.QuerySingleAsync<int>(@"
                INSERT INTO rx_templates (doctor_id, name, payload) VALUES (@DoctorId, @name, @payload::jsonb)
                ON CONFLICT (doctor_id, name) DO UPDATE SET payload = EXCLUDED.payload
                RETURNING id;", new { req.DoctorId, name = req.Name.Trim(), payload = req.Payload.GetRawText() });
            return Results.Ok(new { Success = true, Id = id });
        });

        group.MapDelete("/{id:int}", async (int id, int doctorId, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var n = await db.ExecuteAsync("DELETE FROM rx_templates WHERE id = @id AND doctor_id = @doctorId;", new { id, doctorId });
            return n > 0 ? Results.Ok(new { Success = true }) : Results.NotFound();
        });
    }
}
