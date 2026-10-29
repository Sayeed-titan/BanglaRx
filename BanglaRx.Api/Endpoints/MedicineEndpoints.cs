using BanglaRx.Api.Services;
using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class MedicineEndpoints
{
    public static void MapMedicineEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/medicines").WithTags("Medicines");

        group.MapGet("/", async (string? q, int limit = 50, IDbConnectionFactory connectionFactory = null!) =>
        {
            using var db = connectionFactory.CreateConnection();
            if (string.IsNullOrWhiteSpace(q))
            {
                var all = await db.QueryAsync<Medicine>(
                    "SELECT * FROM medicines ORDER BY brand_name ASC LIMIT @limit;", new { limit });
                return Results.Ok(all);
            }

            var cleanQ = q.Trim();
            var query = @"
                SELECT *, 
                       GREATEST(similarity(brand_name, @cleanQ), similarity(generic_name, @cleanQ)) AS sim_score
                FROM medicines 
                WHERE brand_name % @cleanQ 
                   OR generic_name % @cleanQ
                   OR brand_name ILIKE @pattern 
                   OR generic_name ILIKE @pattern
                ORDER BY 
                    CASE WHEN brand_name ILIKE @exact THEN 0 ELSE 1 END,
                    sim_score DESC,
                    brand_name ASC
                LIMIT @limit;";

            var results = await db.QueryAsync<Medicine>(query, new 
            { 
                cleanQ,
                pattern = $"%{cleanQ}%", 
                exact = $"{cleanQ}%",
                limit 
            });
            return Results.Ok(results);
        });

        // Resolve spoken/typed medicine names to formulary rows (strength-aware). Used by tests and manual entry.
        group.MapPost("/resolve", async (List<PrescriptionItem> items, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var results = new List<PrescriptionItem>();
            foreach (var item in items)
                results.Add(await MedicineResolver.ResolveAsync(db, item, new List<Medicine>()));
            return Results.Ok(results);
        });
    }
}
