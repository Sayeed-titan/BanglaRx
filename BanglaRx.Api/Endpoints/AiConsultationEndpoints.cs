using BanglaRx.Api.Models.DTOs;
using BanglaRx.Api.Services;

namespace BanglaRx.Api.Endpoints;

public static class AiConsultationEndpoints
{
    public static void MapAiConsultationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai").WithTags("AI");

        group.MapPost("/analyze-consultation", async (ConsultationInput input, IConsultationAiService aiService) =>
        {
            var text = input.Transcript ?? input.DoctorNotes ?? "";
            if (string.IsNullOrWhiteSpace(text))
            {
                return Results.BadRequest(new { Error = "Consultation transcript or notes cannot be empty." });
            }

            try
            {
                var result = await aiService.AnalyzeConsultationAsync(input);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                return Results.Problem(detail: ex.Message, title: "Gemini Neural Engine Inference Failed");
            }
        });
    }
}
