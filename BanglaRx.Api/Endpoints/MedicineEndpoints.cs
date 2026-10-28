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

            var query = @"
                SELECT * FROM medicines 
                WHERE brand_name ILIKE @pattern 
                   OR generic_name ILIKE @pattern
                ORDER BY 
                    CASE WHEN brand_name ILIKE @exact THEN 0 ELSE 1 END,
                    brand_name ASC
                LIMIT @limit;";

            var results = await db.QueryAsync<Medicine>(query, new 
            { 
                pattern = $"%{q}%", 
                exact = $"{q}%",
                limit 
            });
            return Results.Ok(results);
        });
    }
}
