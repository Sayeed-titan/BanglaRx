using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using BanglaRx.Api.Data;
using Dapper;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace BanglaRx.Api.Auth;

/// <summary>Who is calling, as the database sees them right now (not as the token claimed hours ago).</summary>
public record CurrentUser(int Id, string Username, string DisplayName, string Role, int? DoctorId, bool MustChangePassword);

public static class AuthSetup
{
    public const string UserItem = "rx.user";

    public static CurrentUser? GetUser(this HttpContext ctx) => ctx.Items.TryGetValue(UserItem, out var u) ? u as CurrentUser : null;

    public static WebApplicationBuilder AddBanglaRxAuth(this WebApplicationBuilder builder)
    {
        var options = new AuthOptions();
        builder.Configuration.GetSection("Auth").Bind(options);
        builder.Services.AddSingleton(options);
        var keys = new JwtKeyProvider();
        builder.Services.AddSingleton(keys);

        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = options.Issuer,
                    ValidateAudience = true,
                    ValidAudience = options.Audience,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    ValidateIssuerSigningKey = true,
                    ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                    IssuerSigningKeyResolver = (_, _, _, _) => new[] { keys.Key },
                };
                o.Events = new JwtBearerEvents
                {
                    // A valid signature is not enough: the account must still exist, be active, and not have signed out everywhere.
                    OnTokenValidated = async ctx =>
                    {
                        var idText = ctx.Principal?.FindFirstValue(JwtRegisteredClaimNames.Sub);
                        var tv = ctx.Principal?.FindFirstValue("tv");
                        if (!int.TryParse(idText, out var id) || !int.TryParse(tv, out var tokenVersion)) { ctx.Fail("bad token"); return; }

                        var factory = ctx.HttpContext.RequestServices.GetRequiredService<IDbConnectionFactory>();
                        using var db = factory.CreateConnection();
                        var row = await db.QueryFirstOrDefaultAsync<UserRow>(
                            "SELECT id, username, display_name, role, doctor_id, is_active, token_version, must_change_password FROM users WHERE id = @id;", new { id });
                        if (row is null || !row.IsActive || row.TokenVersion != tokenVersion) { ctx.Fail("revoked"); return; }
                        ctx.HttpContext.Items[UserItem] = new CurrentUser(row.Id, row.Username, row.DisplayName, row.Role, row.DoctorId, row.MustChangePassword);
                    },
                };
            });
        builder.Services.AddAuthorization();
        return builder;
    }

    private record UserRow(int Id, string Username, string DisplayName, string Role, int? DoctorId, bool IsActive, int TokenVersion, bool MustChangePassword);

    /// <summary>Call after the database schema exists.</summary>
    public static async Task InitBanglaRxAuthAsync(this WebApplication app)
    {
        var factory = app.Services.GetRequiredService<IDbConnectionFactory>();
        await AuthSchema.EnsureAsync(factory);
        await app.Services.GetRequiredService<JwtKeyProvider>().InitAsync(factory, app.Services.GetRequiredService<AuthOptions>());
    }

    public static string CreateToken(JwtKeyProvider keys, AuthOptions options, int id, string username, string role, int? doctorId, int tokenVersion, out DateTime expires)
    {
        expires = DateTime.UtcNow.AddHours(options.TokenHours);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, username),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new("role", role),
            new("tv", tokenVersion.ToString()),
        };
        if (doctorId is int d) claims.Add(new Claim("doctor_id", d.ToString()));
        var token = new JwtSecurityToken(options.Issuer, options.Audience, claims, DateTime.UtcNow, expires,
            new SigningCredentials(keys.Key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
