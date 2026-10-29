using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using BanglaRx.Api.Auth;
using BanglaRx.Api.Data;
using Dapper;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace BanglaRx.Api.PatientApp;

public class PatientOptions
{
    public int OtpSeconds { get; set; } = 300;
    public int MaxVerifyAttempts { get; set; } = 5;
    public int CodesPerPhonePer10Min { get; set; } = 3;
    public int CodesPerIpPer10Min { get; set; } = 20;
    public int TokenDays { get; set; } = 14;
    public int MaxLiveBookings { get; set; } = 5;
    /// <summary>A patient may cancel only this many hours or more before the appointment. After that, call the clinic.</summary>
    public int CancelHoursBefore { get; set; } = 2;
    public string Audience { get; set; } = "banglarx-patients";
}

public class SmsOptions
{
    /// <summary>"log" (default, development: the message is printed in the API window), "http" (a gateway you configure), or "test" (tests only), or "demo" (showcase: also shows the code on screen; never for real patients).</summary>
    public string Provider { get; set; } = "log";
    public string? Url { get; set; }
    /// <summary>Request body with {to} and {message} filled in. Example: {"to":"{to}","text":"{message}"}</summary>
    public string Body { get; set; } = "{\"to\":\"{to}\",\"message\":\"{message}\"}";
    public string ContentType { get; set; } = "application/json";
    public string? AuthHeaderName { get; set; }
    /// <summary>The gateway key. Put it in appsettings.local.json (git-ignored), never in code.</summary>
    public string? AuthHeaderValue { get; set; }
}

public record PatientAccount(int Id, string Phone);

/// <summary>Bangladesh mobile numbers, however they were typed, in one form: +8801XXXXXXXXX.</summary>
public static partial class Phones
{
    [GeneratedRegex(@"^\+8801[3-9]\d{8}$")]
    private static partial Regex Valid();

    public static string? Normalize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        string candidate;
        if (digits.StartsWith("8801") && digits.Length == 13) candidate = "+" + digits;
        else if (digits.StartsWith("01") && digits.Length == 11) candidate = "+88" + digits;
        else if (digits.StartsWith("1") && digits.Length == 10) candidate = "+880" + digits;
        else return null;
        return Valid().IsMatch(candidate) ? candidate : null;
    }

    public static string Last10(string normalized) => normalized[^10..];
    public static string Mask(string normalized) => $"{normalized[..4]}******{normalized[^3..]}";
}

// ---- Sending the code ---------------------------------------------------------------------------

public interface ISmsSender
{
    Task<bool> SendAsync(string toPhone, string message);
}

/// <summary>Development: prints the message in the API window. Fine on your own machine, not for real patients.</summary>
public class LogSmsSender : ISmsSender
{
    public Task<bool> SendAsync(string toPhone, string message)
    {
        Console.WriteLine($"[SMS (development log) to {toPhone}] {message}");
        return Task.FromResult(true);
    }
}

/// <summary>Showcase only: prints the message in the API window AND keeps the newest one so the sign-in screen can show the code. Never use with real patients.</summary>
public class DemoSmsSender : ISmsSender
{
    public static readonly ConcurrentDictionary<string, string> Last = new();
    public Task<bool> SendAsync(string toPhone, string message)
    {
        Last[toPhone] = message;
        Console.WriteLine($"[SMS (demo) to {toPhone}] {message}");
        return Task.FromResult(true);
    }
}

/// <summary>Tests only: keeps the last message per number so a test can read the code. Never enabled by default.</summary>
public class TestSmsSender : ISmsSender
{
    public static readonly ConcurrentDictionary<string, string> Last = new();
    public Task<bool> SendAsync(string toPhone, string message)
    {
        Last[toPhone] = message;
        return Task.FromResult(true);
    }
}

/// <summary>A generic HTTP gateway: POSTs the configured body to the configured URL. Check your provider's exact format.</summary>
public class HttpSmsSender : ISmsSender
{
    private readonly SmsOptions _o;
    private readonly IHttpClientFactory _http;

    public HttpSmsSender(SmsOptions o, IHttpClientFactory http)
    {
        _o = o;
        _http = http;
    }

    public async Task<bool> SendAsync(string toPhone, string message)
    {
        if (string.IsNullOrWhiteSpace(_o.Url)) return false;
        try
        {
            var esc = (string s) => System.Text.Json.JsonEncodedText.Encode(s).ToString();
            var body = _o.Body.Replace("{to}", esc(toPhone)).Replace("{message}", esc(message));
            using var req = new HttpRequestMessage(HttpMethod.Post, _o.Url) { Content = new StringContent(body, Encoding.UTF8) };
            req.Content.Headers.ContentType = new MediaTypeHeaderValue(_o.ContentType);
            if (!string.IsNullOrWhiteSpace(_o.AuthHeaderName) && !string.IsNullOrWhiteSpace(_o.AuthHeaderValue))
                req.Headers.TryAddWithoutValidation(_o.AuthHeaderName, _o.AuthHeaderValue);
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            using var res = await client.SendAsync(req);
            return res.IsSuccessStatusCode;
        }
        catch (Exception)
        {
            return false;
        }
    }
}

// ---- Schema -------------------------------------------------------------------------------------

public static class PatientSchema
{
    public static async Task EnsureAsync(IDbConnectionFactory f)
    {
        try
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            await db.ExecuteAsync(@"
                -- one account per verified phone number
                CREATE TABLE IF NOT EXISTS patient_accounts (
                    id SERIAL PRIMARY KEY,
                    phone VARCHAR(20) NOT NULL UNIQUE,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    token_version INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    last_login_at TIMESTAMP WITH TIME ZONE
                );

                -- which people (patient records) an account may act for: themselves and their family
                CREATE TABLE IF NOT EXISTS patient_account_profiles (
                    account_id INT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
                    patient_id INT NOT NULL REFERENCES patients(id),
                    link VARCHAR(20) NOT NULL DEFAULT 'phone_match' CHECK (link IN ('phone_match','added_by_patient')),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (account_id, patient_id)
                );

                -- one-time codes: only a keyed hash is stored, never the code
                CREATE TABLE IF NOT EXISTS otp_codes (
                    id BIGSERIAL PRIMARY KEY,
                    phone VARCHAR(20) NOT NULL,
                    code_hash TEXT NOT NULL,
                    attempts INT NOT NULL DEFAULT 0,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    consumed_at TIMESTAMP WITH TIME ZONE,
                    ip TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes (phone, created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_otp_ip ON otp_codes (ip, created_at DESC);

                -- what the patient allowed. record_visit NULL means not answered yet (treated as not allowed).
                CREATE TABLE IF NOT EXISTS patient_consents (
                    account_id INT PRIMARY KEY REFERENCES patient_accounts(id) ON DELETE CASCADE,
                    record_visit BOOLEAN,
                    reminders BOOLEAN NOT NULL DEFAULT FALSE,
                    store_reports BOOLEAN NOT NULL DEFAULT FALSE,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                -- every choice ever made, with its date, so we can show what was agreed and when
                CREATE TABLE IF NOT EXISTS patient_consent_log (
                    id BIGSERIAL PRIMARY KEY,
                    account_id INT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
                    record_visit BOOLEAN,
                    reminders BOOLEAN NOT NULL,
                    store_reports BOOLEAN NOT NULL,
                    ip TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            ");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Patient Schema Note]: {ex.Message}");
        }
    }
}

// ---- Codes and tokens -------------------------------------------------------------------------

public class PatientAuthService
{
    private readonly PatientOptions _o;
    private readonly JwtKeyProvider _keys;
    private readonly AuthOptions _staff;
    private readonly ISmsSender _sms;

    public PatientAuthService(PatientOptions o, JwtKeyProvider keys, AuthOptions staff, ISmsSender sms)
    {
        _o = o;
        _keys = keys;
        _staff = staff;
        _sms = sms;
    }

    public PatientOptions Options => _o;

    private string Hash(string phone, string code)
    {
        using var h = new HMACSHA256(_keys.Key.Key.Concat(Encoding.UTF8.GetBytes("otp")).ToArray());
        return Convert.ToBase64String(h.ComputeHash(Encoding.UTF8.GetBytes($"{phone}|{code}")));
    }

    /// <summary>Returns 200 on success, 429 when asked too often, 503 when the SMS could not be sent.</summary>
    public async Task<int> RequestCodeAsync(NpgsqlConnection db, string phone, string? ip)
    {
        var perPhone = await db.ExecuteScalarAsync<int>("SELECT count(*) FROM otp_codes WHERE phone = @phone AND created_at > now() - interval '10 minutes';", new { phone });
        var perIp = ip is null ? 0 : await db.ExecuteScalarAsync<int>("SELECT count(*) FROM otp_codes WHERE ip = @ip AND created_at > now() - interval '10 minutes';", new { ip });
        if (perPhone >= _o.CodesPerPhonePer10Min || perIp >= _o.CodesPerIpPer10Min) return 429;

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var id = await db.ExecuteScalarAsync<long>(
            "INSERT INTO otp_codes (phone, code_hash, expires_at, ip) VALUES (@phone, @hash, now() + make_interval(secs => @secs), @ip) RETURNING id;",
            new { phone, hash = Hash(phone, code), secs = (double)_o.OtpSeconds, ip });

        var minutes = Math.Max(1, _o.OtpSeconds / 60);
        var sent = await _sms.SendAsync(phone, $"BanglaRx: your code is {code}. It works for {minutes} minutes. Do not share it with anyone.");
        if (!sent)
        {
            await db.ExecuteAsync("DELETE FROM otp_codes WHERE id = @id;", new { id });
            return 503;
        }
        return 200;
    }

    /// <summary>True only for the newest live code, with attempts left, matching exactly. A code works once.</summary>
    public async Task<bool> VerifyCodeAsync(NpgsqlConnection db, string phone, string? code)
    {
        if (code is null || !Regex.IsMatch(code, @"^\d{6}$")) return false;
        await using var tx = await db.BeginTransactionAsync();
        var row = await db.QueryFirstOrDefaultAsync<(long Id, string Hash, int Attempts)>(@"
            SELECT id AS Id, code_hash AS Hash, attempts AS Attempts FROM otp_codes
            WHERE phone = @phone AND consumed_at IS NULL AND expires_at > now()
            ORDER BY id DESC LIMIT 1 FOR UPDATE;", new { phone }, tx);
        if (row.Id == 0 || row.Attempts >= _o.MaxVerifyAttempts)
        {
            await tx.CommitAsync();
            return false;
        }
        var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(row.Hash), Encoding.UTF8.GetBytes(Hash(phone, code)));
        if (ok) await db.ExecuteAsync("UPDATE otp_codes SET consumed_at = now() WHERE phone = @phone AND consumed_at IS NULL;", new { phone }, tx);
        else await db.ExecuteAsync("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = @id;", new { id = row.Id }, tx);
        await tx.CommitAsync();
        return ok;
    }

    public (string Token, DateTime Expires) CreateToken(int accountId, int version)
    {
        var expires = DateTime.UtcNow.AddDays(_o.TokenDays);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, accountId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new Claim("role", "patient"),
            new Claim("pv", version.ToString()),
        };
        var jwt = new JwtSecurityToken(_staff.Issuer, _o.Audience, claims, DateTime.UtcNow, expires, new SigningCredentials(_keys.Key, SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }

    /// <summary>A patient token is only good for patient routes: its audience differs from staff tokens, and the reverse.</summary>
    public async Task<PatientAccount?> ValidateAsync(string? authorization, IDbConnectionFactory f)
    {
        if (authorization is null || !authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
        var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
        try
        {
            var principal = handler.ValidateToken(authorization["Bearer ".Length..].Trim(), new TokenValidationParameters
            {
                ValidateIssuer = true, ValidIssuer = _staff.Issuer,
                ValidateAudience = true, ValidAudience = _o.Audience,
                ValidateLifetime = true, ClockSkew = TimeSpan.FromSeconds(30),
                ValidateIssuerSigningKey = true, IssuerSigningKey = _keys.Key,
                ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
            }, out _);
            if (principal.FindFirstValue("role") != "patient") return null;
            if (!int.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) || !int.TryParse(principal.FindFirstValue("pv"), out var version)) return null;

            using var db = f.CreateConnection();
            var row = await db.QueryFirstOrDefaultAsync<(int Id, string Phone, bool Active, int Version)>(
                "SELECT id AS Id, phone AS Phone, is_active AS Active, token_version AS Version FROM patient_accounts WHERE id = @id;", new { id });
            return row.Id == 0 || !row.Active || row.Version != version ? null : new PatientAccount(row.Id, row.Phone);
        }
        catch (Exception)
        {
            return null;
        }
    }
}
