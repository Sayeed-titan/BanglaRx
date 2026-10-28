using BanglaRx.Api.Models.DTOs;
using BanglaRx.Api.Services;

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
    }
}
