using BanglaRx.Api.Services;

namespace BanglaRx.Api.Endpoints;

public static class SathiEndpoints
{
    public static void MapSathiEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/sathi/chat", async (SathiChatRequest req, SathiService sathi) =>
        {
            if (req.Messages is null || req.Messages.Count == 0) return Results.BadRequest(new { errors = new[] { "Type a question first." } });
            if (req.Messages.Any(m => (m.Text ?? "").Length > 1500)) return Results.BadRequest(new { errors = new[] { "Please keep a message under 1500 characters." } });
            var reply = await sathi.AskAsync(req);
            return reply is null
                ? Results.Json(new { errors = new[] { "Rx Sathi could not answer just now. Try again in a moment." } }, statusCode: 503)
                : Results.Ok(reply);
        }).WithTags("Sathi");
    }
}
