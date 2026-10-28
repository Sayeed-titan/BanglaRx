using BanglaRx.Api.Data;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class StatusEndpoints
{
    public static void MapStatusEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/", (IConfiguration config) => Results.Ok(new
        {
            System = "BanglaRx AI Clinical Engine API",
            Version = "2.5.0-Modular-Clean",
            Status = "Online",
            AiModel = config["Gemini:Model"] ?? "gemini-3.5-flash-lite",
            Architecture = "Modular Minimal APIs (Database-First Dapper)",
            Documentation = "/api/status"
        }));

        app.MapGet("/api/status", async (IDbConnectionFactory connectionFactory, IConfiguration config) =>
        {
            try
            {
                using var db = connectionFactory.CreateConnection();
                await db.OpenAsync();

                var stats = await db.QuerySingleAsync<dynamic>(@"
                    SELECT 
                        (SELECT count(*) FROM medicines) AS total_medicines,
                        (SELECT count(*) FROM drug_interactions) AS total_interactions,
                        (SELECT count(*) FROM patients) AS total_patients,
                        (SELECT count(*) FROM prescriptions) AS total_prescriptions,
                        (SELECT count(*) FROM doctors) AS total_doctors;
                ");

                var apiKey = config["Gemini:ApiKey"];

                return Results.Ok(new
                {
                    DatabaseConnected = true,
                    Engine = "Secure Relational Clinical Data Vault (Database-First PostgreSQL)",
                    DatabaseName = "BanglaRxDB",
                    AiModel = "BanglaRx Neural Core",
                    AiStatus = string.IsNullOrEmpty(apiKey) ? "Not Configured" : "Connected (BanglaRx Ambient Neural Network)",
                    Architecture = "Modular Minimal APIs with Dapper Micro-ORM",
                    Counts = stats,
                    Timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Database Connection Failed");
            }
        });
    }
}
