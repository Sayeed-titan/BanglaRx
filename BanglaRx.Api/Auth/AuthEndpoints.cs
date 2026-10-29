using System.Text.RegularExpressions;
using BanglaRx.Api.Data;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.Auth;

public record LoginRequest(string? Username, string? Password);
public record SetupRequest(string? Username, string? DisplayName, string? Password);
public record CreateUserRequest(string? Username, string? DisplayName, string? Role, int? DoctorId, string? Password);
public record UpdateUserRequest(string? DisplayName, string? Role, int? DoctorId, bool? IsActive);
public record ResetPasswordRequest(string? Password);
public record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public record SessionUser(int Id, string Username, string DisplayName, string Role, int? DoctorId);
public record SessionResponse(string Token, DateTime ExpiresAt, SessionUser User, bool MustChangePassword);

/// <summary>Sign-in, sign-out, first-time setup, and the manager's user list.</summary>
public static class AuthEndpoints
{
    private static readonly Regex UsernameShape = new("^[a-z0-9][a-z0-9._-]{2,39}$", RegexOptions.Compiled);

    private record UserRecord(int Id, string Username, string DisplayName, string Role, int? DoctorId, string PasswordHash,
        bool IsActive, bool MustChangePassword, int TokenVersion, int FailedAttempts, int LockedSeconds);

    private const string UserSelect = @"
        SELECT id, username, display_name AS DisplayName, role, doctor_id AS DoctorId, password_hash AS PasswordHash,
               is_active AS IsActive, must_change_password AS MustChangePassword, token_version AS TokenVersion,
               failed_attempts AS FailedAttempts,
               COALESCE(CEIL(EXTRACT(EPOCH FROM (locked_until - now()))), 0)::int AS LockedSeconds
        FROM users";

    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/api/auth").WithTags("Auth");

        // The screen asks this first: is sign-in required, and has anyone been set up yet?
        auth.MapGet("/status", async (IDbConnectionFactory f, AuthOptions options) =>
        {
            using var db = f.CreateConnection();
            var hasUsers = await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM users);");
            return Results.Ok(new { enforced = options.Enforce, hasUsers });
        });

        // First run only: whoever sets up becomes the manager. Refused once any user exists.
        auth.MapPost("/setup", async (SetupRequest req, HttpContext ctx, IDbConnectionFactory f, AuthOptions options, JwtKeyProvider keys) =>
        {
            var username = (req.Username ?? "").Trim().ToLowerInvariant();
            var errors = ValidateNewUser(username, req.DisplayName, req.Password);
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            using var db = f.CreateConnection();
            await db.OpenAsync();
            var id = await db.ExecuteScalarAsync<int?>(@"
                INSERT INTO users (username, display_name, role, password_hash)
                SELECT @username, @displayName, 'manager', @hash WHERE NOT EXISTS (SELECT 1 FROM users)
                RETURNING id;", new { username, displayName = req.DisplayName!.Trim(), hash = PasswordHasher.Hash(req.Password!) });
            if (id is null) return Results.Conflict(new { errors = new[] { "Setup is already done. Ask your manager for an account." } });

            await Audit(db, ctx, id, username, "setup", "first manager created");
            return Results.Ok(await StartSession(db, ctx, keys, options, id.Value, "login", signedByPassword: false));
        });

        auth.MapPost("/login", async (LoginRequest req, HttpContext ctx, IDbConnectionFactory f, AuthOptions options, JwtKeyProvider keys) =>
        {
            const string wrong = "Wrong username or password.";
            var username = (req.Username ?? "").Trim().ToLowerInvariant();
            using var db = f.CreateConnection();
            await db.OpenAsync();

            var user = username.Length == 0 ? null : await db.QueryFirstOrDefaultAsync<UserRecord>($"{UserSelect} WHERE lower(username) = @username;", new { username });

            // locked accounts are refused before the password is even looked at
            if (user is { IsActive: true, LockedSeconds: > 0 })
            {
                await Audit(db, ctx, user.Id, username, "login_blocked", "account locked");
                var minutes = (int)Math.Ceiling(user.LockedSeconds / 60.0);
                return Results.Json(new { errors = new[] { $"Too many wrong attempts. Try again in {minutes} minute{(minutes == 1 ? "" : "s")}." } }, statusCode: 423);
            }

            // always do the full password work, so timing does not reveal whether the username exists
            var ok = PasswordHasher.Verify(req.Password ?? "", user?.PasswordHash);
            if (user is null || !user.IsActive || !ok)
            {
                if (user is { IsActive: true })
                {
                    var attempts = user.FailedAttempts + 1;
                    if (attempts >= options.MaxFailedAttempts)
                    {
                        await db.ExecuteAsync("UPDATE users SET failed_attempts = 0, locked_until = now() + make_interval(mins => @mins) WHERE id = @id;", new { id = user.Id, mins = options.LockMinutes });
                        await Audit(db, ctx, user.Id, username, "locked", $"{options.MaxFailedAttempts} wrong passwords");
                    }
                    else
                    {
                        await db.ExecuteAsync("UPDATE users SET failed_attempts = @attempts WHERE id = @id;", new { id = user.Id, attempts });
                    }
                }
                await Audit(db, ctx, user?.Id, username, "login_failed", user is null ? "unknown username" : !user.IsActive ? "inactive account" : "wrong password");
                return Results.Json(new { errors = new[] { wrong } }, statusCode: 401);
            }

            await db.ExecuteAsync("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = now() WHERE id = @id;", new { id = user.Id });
            return Results.Ok(await StartSession(db, ctx, keys, options, user.Id, "login", signedByPassword: true));
        });

        auth.MapGet("/me", (HttpContext ctx) =>
        {
            var u = ctx.GetUser();
            return u is null
                ? Results.Json(new { errors = new[] { "Please sign in." } }, statusCode: 401)
                : Results.Ok(new { user = new SessionUser(u.Id, u.Username, u.DisplayName, u.Role, u.DoctorId), mustChangePassword = u.MustChangePassword });
        });

        // Signs this account out everywhere: every token it holds stops working.
        auth.MapPost("/logout", async (HttpContext ctx, IDbConnectionFactory f) =>
        {
            var u = ctx.GetUser();
            if (u is null) return Results.NoContent();
            using var db = f.CreateConnection();
            await db.ExecuteAsync("UPDATE users SET token_version = token_version + 1 WHERE id = @id;", new { id = u.Id });
            await Audit(db, ctx, u.Id, u.Username, "logout", null);
            return Results.NoContent();
        });

        auth.MapPost("/change-password", async (ChangePasswordRequest req, HttpContext ctx, IDbConnectionFactory f, AuthOptions options, JwtKeyProvider keys) =>
        {
            var me = ctx.GetUser();
            if (me is null) return Results.Json(new { errors = new[] { "Please sign in." } }, statusCode: 401);
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var user = await db.QueryFirstAsync<UserRecord>($"{UserSelect} WHERE id = @id;", new { id = me.Id });

            if (!PasswordHasher.Verify(req.CurrentPassword ?? "", user.PasswordHash))
            {
                await Audit(db, ctx, me.Id, me.Username, "password_change_failed", "wrong current password");
                return Results.BadRequest(new { errors = new[] { "The current password is not right." } });
            }
            var problem = PasswordHasher.Check(req.NewPassword, me.Username);
            if (problem is not null) return Results.BadRequest(new { errors = new[] { problem } });
            if (req.NewPassword == req.CurrentPassword) return Results.BadRequest(new { errors = new[] { "Choose a password different from the current one." } });

            await db.ExecuteAsync("UPDATE users SET password_hash = @hash, must_change_password = FALSE, token_version = token_version + 1 WHERE id = @id;",
                new { id = me.Id, hash = PasswordHasher.Hash(req.NewPassword!) });
            await Audit(db, ctx, me.Id, me.Username, "password_changed", null);
            return Results.Ok(await StartSession(db, ctx, keys, options, me.Id, "login", signedByPassword: false));
        });

        auth.MapGet("/events", async (IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            return Results.Ok(await db.QueryAsync<dynamic>("SELECT id, at, user_id, username, event, ip, detail FROM auth_events ORDER BY id DESC LIMIT 200;"));
        });

        // ---- manager: user list ----
        var users = app.MapGroup("/api/users").WithTags("Users");

        users.MapGet("/", async (IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            return Results.Ok(await db.QueryAsync<dynamic>(@"
                SELECT u.id, u.username, u.display_name, u.role, u.doctor_id, d.name AS doctor_name,
                       u.is_active, u.must_change_password, u.last_login_at, u.created_at,
                       (u.locked_until IS NOT NULL AND u.locked_until > now()) AS is_locked
                FROM users u LEFT JOIN doctors d ON d.id = u.doctor_id ORDER BY u.id ASC;"));
        });

        users.MapPost("/", async (CreateUserRequest req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var username = (req.Username ?? "").Trim().ToLowerInvariant();
            var errors = ValidateNewUser(username, req.DisplayName, req.Password);
            using var db = f.CreateConnection();
            await db.OpenAsync();
            errors.AddRange(await ValidateRoleAsync(db, req.Role, req.DoctorId));
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            try
            {
                // a manager hands out a temporary password; the person must replace it at first sign-in
                var id = await db.QuerySingleAsync<int>(@"
                    INSERT INTO users (username, display_name, role, doctor_id, password_hash, must_change_password)
                    VALUES (@username, @displayName, @role, @doctorId, @hash, TRUE) RETURNING id;",
                    new { username, displayName = req.DisplayName!.Trim(), role = req.Role, doctorId = Roles.NeedsDoctor(req.Role!) ? req.DoctorId : null, hash = PasswordHasher.Hash(req.Password!) });
                await Audit(db, ctx, ctx.GetUser()?.Id, ctx.GetUser()?.Username, "user_created", $"{username} as {req.Role}");
                return Results.Ok(new { id });
            }
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                return Results.Conflict(new { errors = new[] { $"The username \"{username}\" is already taken." } });
            }
        });

        users.MapPut("/{id:int}", async (int id, UpdateUserRequest req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var me = ctx.GetUser()!;
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var target = await db.QueryFirstOrDefaultAsync<UserRecord>($"{UserSelect} WHERE id = @id;", new { id });
            if (target is null) return Results.NotFound(new { errors = new[] { "User not found." } });

            var role = req.Role ?? target.Role;
            var active = req.IsActive ?? target.IsActive;
            var doctorId = Roles.NeedsDoctor(role) ? (req.DoctorId ?? target.DoctorId) : null;
            var name = string.IsNullOrWhiteSpace(req.DisplayName) ? target.DisplayName : req.DisplayName.Trim();

            var errors = await ValidateRoleAsync(db, role, doctorId);
            if (id == me.Id && (role != target.Role || !active)) errors.Add("You can't change your own role or switch yourself off.");
            if (target.Role == Roles.Manager && (role != Roles.Manager || !active) && target.IsActive)
            {
                var others = await db.ExecuteScalarAsync<int>("SELECT count(*) FROM users WHERE role = 'manager' AND is_active AND id <> @id;", new { id });
                if (others == 0) errors.Add("There must always be at least one active manager.");
            }
            if (errors.Count > 0) return Results.BadRequest(new { errors });

            var access = role != target.Role || active != target.IsActive || doctorId != target.DoctorId;
            await db.ExecuteAsync(@"
                UPDATE users SET display_name = @name, role = @role, doctor_id = @doctorId, is_active = @active,
                       token_version = token_version + @bump WHERE id = @id;",
                new { id, name, role, doctorId, active, bump = access ? 1 : 0 });
            await Audit(db, ctx, me.Id, me.Username, "user_changed", $"{target.Username}: role {target.Role}->{role}, active {target.IsActive}->{active}");
            return Results.Ok(new { id });
        });

        users.MapPost("/{id:int}/reset-password", async (int id, ResetPasswordRequest req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var target = await db.QueryFirstOrDefaultAsync<UserRecord>($"{UserSelect} WHERE id = @id;", new { id });
            if (target is null) return Results.NotFound(new { errors = new[] { "User not found." } });
            var problem = PasswordHasher.Check(req.Password, target.Username);
            if (problem is not null) return Results.BadRequest(new { errors = new[] { problem } });

            await db.ExecuteAsync(@"UPDATE users SET password_hash = @hash, must_change_password = TRUE, failed_attempts = 0,
                                    locked_until = NULL, token_version = token_version + 1 WHERE id = @id;",
                new { id, hash = PasswordHasher.Hash(req.Password!) });
            await Audit(db, ctx, ctx.GetUser()?.Id, ctx.GetUser()?.Username, "password_reset", target.Username);
            return Results.NoContent();
        });
    }

    private static List<string> ValidateNewUser(string username, string? displayName, string? password)
    {
        var errors = new List<string>();
        if (!UsernameShape.IsMatch(username)) errors.Add("The username must be 3 to 40 letters, numbers, dots, dashes or underscores, starting with a letter or number.");
        if (string.IsNullOrWhiteSpace(displayName)) errors.Add("The person's name is required.");
        else if (displayName.Trim().Length > 150) errors.Add("The name is too long.");
        var problem = PasswordHasher.Check(password, username);
        if (problem is not null) errors.Add(problem);
        return errors;
    }

    private static async Task<List<string>> ValidateRoleAsync(NpgsqlConnection db, string? role, int? doctorId)
    {
        var errors = new List<string>();
        if (role is null || !Roles.All.Contains(role)) { errors.Add($"The role must be one of: {string.Join(", ", Roles.All)}."); return errors; }
        if (Roles.NeedsDoctor(role))
        {
            if (doctorId is null) errors.Add($"A {role} must be linked to a doctor.");
            else if (!await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM doctors WHERE id = @doctorId);", new { doctorId })) errors.Add("The linked doctor does not exist.");
        }
        return errors;
    }

    private static async Task<SessionResponse> StartSession(NpgsqlConnection db, HttpContext ctx, JwtKeyProvider keys, AuthOptions options, int id, string eventName, bool signedByPassword)
    {
        var u = await db.QueryFirstAsync<UserRecord>($"{UserSelect} WHERE id = @id;", new { id });
        var token = AuthSetup.CreateToken(keys, options, u.Id, u.Username, u.Role, u.DoctorId, u.TokenVersion, out var expires);
        if (signedByPassword) await Audit(db, ctx, u.Id, u.Username, eventName, null);
        return new SessionResponse(token, expires, new SessionUser(u.Id, u.Username, u.DisplayName, u.Role, u.DoctorId), u.MustChangePassword);
    }

    private static Task Audit(NpgsqlConnection db, HttpContext ctx, int? userId, string? username, string eventName, string? detail) =>
        db.ExecuteAsync("INSERT INTO auth_events (user_id, username, event, ip, detail) VALUES (@userId, @username, @eventName, @ip, @detail);",
            new { userId, username, eventName, ip = ctx.Connection.RemoteIpAddress?.ToString(), detail });
}
