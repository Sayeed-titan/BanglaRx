using System.Security.Cryptography;
using BanglaRx.Api.Data;
using Dapper;
using Microsoft.IdentityModel.Tokens;

namespace BanglaRx.Api.Auth;

public static class Roles
{
    public const string Doctor = "doctor";
    public const string Assistant = "assistant";
    public const string Receptionist = "receptionist";
    public const string Pharmacist = "pharmacist";
    public const string Manager = "manager";

    public static readonly string[] All = { Doctor, Assistant, Receptionist, Pharmacist, Manager };
    /// <summary>Roles that work inside one doctor's chamber and so must be linked to that doctor.</summary>
    public static bool NeedsDoctor(string role) => role is Doctor or Assistant;
}

public class AuthOptions
{
    /// <summary>True by default: every internal route needs a staff sign-in. Set Auth:Enforce to false only on a private development machine.</summary>
    public bool Enforce { get; set; } = true;
    public int TokenHours { get; set; } = 12;
    public int MaxFailedAttempts { get; set; } = 5;
    public int LockMinutes { get; set; } = 15;
    public string Issuer { get; set; } = "banglarx";
    public string Audience { get; set; } = "banglarx-staff";
    /// <summary>Optional. When empty, a random key is generated once and kept in the database (app_secrets).</summary>
    public string? JwtSecret { get; set; }
}

/// <summary>The key that signs sign-in tokens. From config if set, otherwise generated once and stored.</summary>
public class JwtKeyProvider
{
    private SymmetricSecurityKey? _key;
    public SymmetricSecurityKey Key => _key ?? throw new InvalidOperationException("Auth is not initialised yet.");

    public async Task InitAsync(IDbConnectionFactory f, AuthOptions options)
    {
        string secret;
        if (!string.IsNullOrWhiteSpace(options.JwtSecret) && options.JwtSecret.Length >= 32)
        {
            secret = options.JwtSecret;
        }
        else
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            secret = await db.ExecuteScalarAsync<string?>("SELECT value FROM app_secrets WHERE key = 'jwt_signing_key';") ?? "";
            if (secret.Length == 0)
            {
                var fresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
                // two API instances starting together must agree on one key
                await db.ExecuteAsync("INSERT INTO app_secrets (key, value) VALUES ('jwt_signing_key', @fresh) ON CONFLICT (key) DO NOTHING;", new { fresh });
                secret = await db.ExecuteScalarAsync<string>("SELECT value FROM app_secrets WHERE key = 'jwt_signing_key';") ?? fresh;
            }
        }
        _key = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(secret));
    }
}

/// <summary>Users, an audit trail of every sign-in event, and the signing key. Additive and idempotent.</summary>
public static class AuthSchema
{
    public static async Task EnsureAsync(IDbConnectionFactory f)
    {
        using var db = f.CreateConnection();
        await db.OpenAsync();
        await db.ExecuteAsync(@"
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(60) NOT NULL,
                display_name VARCHAR(150) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('doctor','assistant','receptionist','pharmacist','manager')),
                doctor_id INT REFERENCES doctors(id),
                password_hash TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
                token_version INT NOT NULL DEFAULT 0,
                failed_attempts INT NOT NULL DEFAULT 0,
                locked_until TIMESTAMP WITH TIME ZONE,
                last_login_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));

            CREATE TABLE IF NOT EXISTS auth_events (
                id BIGSERIAL PRIMARY KEY,
                at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                user_id INT,
                username TEXT,
                event TEXT NOT NULL,
                ip TEXT,
                detail TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_auth_events_at ON auth_events (at DESC);

            CREATE TABLE IF NOT EXISTS app_secrets (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ");
    }
}
