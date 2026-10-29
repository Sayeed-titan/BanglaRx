using System.Text.Json;
using System.Text.RegularExpressions;
using BanglaRx.Api.Data;
using Dapper;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Primitives;

namespace BanglaRx.Api.Auth;

/// <summary>
/// WHO MAY CALL WHAT. This table is the single place to read and audit access.
///   null roles   = public (no sign-in)
///   "*"          = any signed-in user
/// First matching row wins. A route that matches no row is manager-only, so a new endpoint is locked
/// until someone decides who may use it.
/// </summary>
public static class RoleRules
{
    private static readonly string[] Clinical = { Roles.Doctor, Roles.Assistant, Roles.Manager };
    private static readonly string[] Front = { Roles.Doctor, Roles.Assistant, Roles.Receptionist, Roles.Manager };
    private static readonly string[] Any = { "*" };
    private static readonly string[] ManagerOnly = { Roles.Manager };

    public record Rule(string Method, string Pattern, string[]? Roles)
    {
        public Regex Matcher { get; } = new("^" + Regex.Escape(Pattern).Replace("\\{", "{").Replace("\\}", "}").Replace("{id}", "[^/]+").Replace("\\*\\*", ".*") + "/?$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }

    public static readonly Rule[] Rows =
    {
        // public
        new("GET", "/api/status", null),
        // the patient app signs in with its own tokens and checks them itself (see PatientApp/PatientAppEndpoints.cs)
        new("*", "/api/patient/**", null),
        new("*", "/api/public/**", null),
        new("*", "/api/inbox", new[] { Roles.Receptionist, Roles.Manager }),
        new("*", "/api/inbox/**", new[] { Roles.Receptionist, Roles.Manager }),
        new("GET", "/api/_test/sms", null),
        new("GET", "/api/auth/status", null),
        new("POST", "/api/auth/login", null),
        new("POST", "/api/auth/setup", null),
        // any signed-in user
        new("GET", "/api/auth/me", Any),
        new("POST", "/api/auth/logout", Any),
        new("POST", "/api/auth/change-password", Any),
        // manager only
        new("GET", "/api/auth/events", ManagerOnly),
        new("*", "/api/users", ManagerOnly),
        new("*", "/api/users/**", ManagerOnly),
        new("POST", "/api/branches", ManagerOnly),
        new("PUT", "/api/branches/{id}", ManagerOnly),
        new("PUT", "/api/doctors/{id}/schedule", ManagerOnly),
        new("POST", "/api/doctors", ManagerOnly),
        new("PUT", "/api/doctors/{id}", new[] { Roles.Doctor, Roles.Manager }),
        // reading the practice
        new("GET", "/api/doctors", Any),
        new("GET", "/api/branches", Front),
        new("GET", "/api/specialties", Front),
        new("GET", "/api/schedules", Front),
        new("GET", "/api/patients", Front),
        new("POST", "/api/patients", Front),
        new("GET", "/api/patients/{id}/consent", Clinical),
        new("*", "/api/queue", Front),
        new("*", "/api/queue/**", Front),
        // prescriptions: the doctor writes, the doctor's team and the manager read. Pharmacists use /api/pharmacy instead.
        new("GET", "/api/prescriptions", Clinical),
        new("GET", "/api/prescriptions/**", Clinical),
        new("POST", "/api/prescriptions", new[] { Roles.Doctor }),
        new("PUT", "/api/prescriptions/{id}", new[] { Roles.Doctor }),
        new("*", "/api/templates", new[] { Roles.Doctor, Roles.Assistant }),
        new("*", "/api/templates/**", new[] { Roles.Doctor, Roles.Assistant }),
        new("GET", "/api/medicines", new[] { Roles.Doctor, Roles.Assistant, Roles.Pharmacist, Roles.Manager }),
        new("POST", "/api/medicines/resolve", new[] { Roles.Doctor, Roles.Assistant }),
        new("POST", "/api/interactions/check", new[] { Roles.Doctor, Roles.Assistant }),
        new("POST", "/api/safety/check", new[] { Roles.Doctor, Roles.Assistant }),
        new("POST", "/api/ai/analyze-consultation", new[] { Roles.Doctor, Roles.Assistant }),
        // booking: the front desk and manager book; the doctor's team can read their own doctor's bookings
        new("GET", "/api/slots", Front),
        new("GET", "/api/booking/info", Front),
        new("GET", "/api/bookings", Front),
        new("*", "/api/bookings", new[] { Roles.Receptionist, Roles.Manager }),
        new("*", "/api/bookings/**", new[] { Roles.Receptionist, Roles.Manager }),
        // pharmacy sees only signed prescriptions, with no diagnosis or notes
        new("GET", "/api/pharmacy/**", new[] { Roles.Pharmacist, Roles.Manager }),
    };

    public static Rule? Find(string method, string path) =>
        Rows.FirstOrDefault(r => (r.Method == "*" || r.Method.Equals(method, StringComparison.OrdinalIgnoreCase)) && r.Matcher.IsMatch(path));
}

public class RoleGuardMiddleware
{
    private readonly RequestDelegate _next;
    private readonly AuthOptions _options;

    public RoleGuardMiddleware(RequestDelegate next, AuthOptions options)
    {
        _next = next;
        _options = options;
    }

    public async Task InvokeAsync(HttpContext ctx, IDbConnectionFactory factory)
    {
        var path = ctx.Request.Path.Value ?? "/";
        // Switched off = the API behaves as it always did. The exception is account management: user lists,
        // user changes and the sign-in log are new, and are never open to anonymous callers, switch or no switch.
        var alwaysGuarded = path.StartsWith("/api/users", StringComparison.OrdinalIgnoreCase) || path.Equals("/api/auth/events", StringComparison.OrdinalIgnoreCase);
        if ((!_options.Enforce && !alwaysGuarded) || ctx.Request.Method == "OPTIONS" || !path.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            await _next(ctx);
            return;
        }

        var rule = RoleRules.Find(ctx.Request.Method, path);
        if (rule is { Roles: null })
        {
            await _next(ctx);
            return;
        }

        var user = ctx.GetUser();
        if (user is null)
        {
            await Deny(ctx, 401, "Please sign in.");
            return;
        }

        if (user.MustChangePassword && !path.EndsWith("/auth/change-password", StringComparison.OrdinalIgnoreCase)
            && !path.EndsWith("/auth/me", StringComparison.OrdinalIgnoreCase) && !path.EndsWith("/auth/logout", StringComparison.OrdinalIgnoreCase))
        {
            await Deny(ctx, 403, "Choose a new password before you continue.", "password_change_required");
            return;
        }

        var allowed = rule is null ? user.Role == Roles.Manager : rule.Roles!.Contains("*") || rule.Roles!.Contains(user.Role);
        if (!allowed)
        {
            await Deny(ctx, 403, "Your role can't do that.");
            return;
        }

        var problem = await ScopeAsync(ctx, user, factory);
        if (problem is not null)
        {
            await Deny(ctx, 403, problem);
            return;
        }

        await _next(ctx);
    }

    /// <summary>
    /// A doctor (and the assistant working for that doctor) sees only that doctor's chamber: queue, prescriptions, templates.
    /// This is the "strict doctor_id isolation" rule, enforced on the server, not just hidden in the screen.
    /// </summary>
    private static async Task<string?> ScopeAsync(HttpContext ctx, CurrentUser user, IDbConnectionFactory factory)
    {
        if (!Roles.NeedsDoctor(user.Role)) return null;
        var path = (ctx.Request.Path.Value ?? "/").TrimEnd('/').ToLowerInvariant();
        var method = ctx.Request.Method.ToUpperInvariant();
        var mine = user.DoctorId;
        var scoped = path.StartsWith("/api/queue") || path.StartsWith("/api/prescriptions") || path.StartsWith("/api/templates") || path.StartsWith("/api/bookings")
                     || (path.StartsWith("/api/doctors/") && method == "PUT");
        if (!scoped) return null;
        if (mine is null) return "Your account is not linked to a doctor. Ask the manager.";

        string? Query(string name) => ctx.Request.Query.TryGetValue(name, out var v) ? v.ToString() : null;

        // list-style reads: a doctorId filter is forced to this doctor, and asking for another doctor is refused
        if (method == "GET" && (path == "/api/queue" || path == "/api/bookings" || path == "/api/prescriptions" || path == "/api/prescriptions/latest" || path == "/api/templates"))
        {
            var asked = Query("doctorId");
            if (!string.IsNullOrEmpty(asked) && asked != mine.ToString()) return "That chamber belongs to another doctor.";
            var q = QueryHelpers.ParseQuery(ctx.Request.QueryString.Value ?? "");
            q["doctorId"] = new StringValues(mine.ToString());
            ctx.Request.QueryString = QueryString.Create(q);
            return null;
        }

        if (path == "/api/templates" && method == "DELETE") return null;
        if (path.StartsWith("/api/templates/") && method == "DELETE")
            return Query("doctorId") == mine.ToString() ? null : "That template belongs to another doctor.";

        if (path.StartsWith("/api/doctors/") && method == "PUT")
        {
            var id = path.Split('/').ElementAtOrDefault(3);
            return id == mine.ToString() ? null : "You can only edit your own profile.";
        }

        if ((path == "/api/queue" || path == "/api/prescriptions" || path == "/api/templates") && method is "POST")
        {
            var bodyDoctor = await ReadBodyDoctorIdAsync(ctx);
            return bodyDoctor == mine ? null : "That chamber belongs to another doctor.";
        }

        // single records: look up whose they are
        var seg = path.Split('/');
        if (seg.Length >= 4 && int.TryParse(seg[3], out var recordId))
        {
            using var db = factory.CreateConnection();
            int? owner = seg[2] switch
            {
                "queue" => await db.ExecuteScalarAsync<int?>("SELECT doctor_id FROM appointments WHERE id = @recordId;", new { recordId }),
                "prescriptions" => await db.ExecuteScalarAsync<int?>("SELECT doctor_id FROM prescriptions WHERE id = @recordId;", new { recordId }),
                _ => null,
            };
            // an unknown id is left to the endpoint to answer 404
            if (owner is not null && owner != mine) return "That record belongs to another doctor.";
            if (method == "PUT" && seg[2] == "prescriptions" && (await ReadBodyDoctorIdAsync(ctx)) != mine) return "That chamber belongs to another doctor.";
        }
        return null;
    }

    private static async Task<int?> ReadBodyDoctorIdAsync(HttpContext ctx)
    {
        ctx.Request.EnableBuffering();
        try
        {
            using var doc = await JsonDocument.ParseAsync(ctx.Request.Body);
            foreach (var p in doc.RootElement.EnumerateObject())
                if (p.Name.Equals("doctorId", StringComparison.OrdinalIgnoreCase) && p.Value.TryGetInt32(out var v)) return v;
            return null;
        }
        catch (JsonException) { return null; }
        finally { ctx.Request.Body.Position = 0; }
    }

    private static Task Deny(HttpContext ctx, int status, string message, string? code = null)
    {
        ctx.Response.StatusCode = status;
        return ctx.Response.WriteAsJsonAsync(new { errors = new[] { message }, code });
    }
}
