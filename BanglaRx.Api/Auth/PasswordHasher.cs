using System.Security.Cryptography;

namespace BanglaRx.Api.Auth;

/// <summary>
/// PBKDF2-SHA256 with a random salt per password. Built into .NET, nothing to install.
/// Stored form: pbkdf2-sha256$iterations$salt$hash (base64). Raising Iterations later only affects new hashes.
/// </summary>
public static class PasswordHasher
{
    private const int Iterations = 210_000;
    private const int SaltSize = 16;
    private const int KeySize = 32;
    private const string Scheme = "pbkdf2-sha256";

    // used to burn the same time when a username does not exist, so the answer time does not reveal it
    private static readonly string DummyHash = Hash("not-a-real-password-just-for-timing");

    private static readonly HashSet<string> TooCommon = new(StringComparer.OrdinalIgnoreCase)
    {
        "password", "password1", "password123", "1234567890", "12345678910", "qwertyuiop", "iloveyou123",
        "admin12345", "welcome123", "bangladesh", "bangladesh1", "banglarx123", "letmein1234",
    };

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeySize);
        return $"{Scheme}${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(key)}";
    }

    private static bool TryParse(string? stored, out int iterations, out byte[] salt, out byte[] hash)
    {
        iterations = 0; salt = Array.Empty<byte>(); hash = Array.Empty<byte>();
        var parts = stored?.Split('$');
        if (parts is not { Length: 4 } || parts[0] != Scheme || !int.TryParse(parts[1], out iterations)) return false;
        try { salt = Convert.FromBase64String(parts[2]); hash = Convert.FromBase64String(parts[3]); return true; }
        catch (FormatException) { return false; }
    }

    /// <summary>Always does the full amount of work, even when the user or hash is missing.</summary>
    public static bool Verify(string password, string? stored)
    {
        var known = TryParse(stored, out var iterations, out var salt, out var hash);
        if (!known) TryParse(DummyHash, out iterations, out salt, out hash);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, hash.Length);
        return CryptographicOperations.FixedTimeEquals(actual, hash) && known;
    }

    /// <summary>Length matters more than tricks. Returns a plain-language problem, or null when the password is fine.</summary>
    public static string? Check(string? password, string username)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 10) return "The password must be at least 10 characters.";
        if (password.Length > 128) return "The password must be 128 characters or fewer.";
        if (password.Trim() != password) return "The password cannot start or end with a space.";
        if (!string.IsNullOrEmpty(username) && password.Contains(username, StringComparison.OrdinalIgnoreCase)) return "The password cannot contain the username.";
        if (TooCommon.Contains(password) || password.Distinct().Count() < 4) return "That password is too easy to guess. Choose a longer, less common one.";
        return null;
    }
}
