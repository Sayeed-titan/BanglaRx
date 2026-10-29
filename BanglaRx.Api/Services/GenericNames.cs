using System.Text.RegularExpressions;

namespace BanglaRx.Api.Services;

/// <summary>Normalizes generic names into exact active-ingredient components (no substring guessing).</summary>
public static class GenericNames
{
    private static readonly Regex Parenthetical = new(@"\([^)]*\)", RegexOptions.Compiled);
    private static readonly Regex Separators = new(@"\s*(\+|/|,|;|&|\band\b)\s*", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex Spaces = new(@"\s+", RegexOptions.Compiled);

    // Salt / form words that are not the active moiety ("Warfarin Sodium" == "Warfarin").
    // Deliberately NOT stripped: hydroxide, oxide, acid (they define different ingredients).
    private static readonly Regex Salts = new(
        @"\b(sodium|potassium|calcium|hydrochloride|hcl|hydrobromide|maleate|besylate|besilate|mesylate|tartrate|succinate|sulfate|sulphate|phosphate|acetate|citrate|fumarate|trihydrate|dihydrate|monohydrate|anhydrous|hemihydrate|axetil|medoxomil|proxetil)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static List<string> Components(string? generic)
    {
        if (string.IsNullOrWhiteSpace(generic)) return new List<string>();
        var cleaned = Parenthetical.Replace(generic, " ");
        return Separators.Split(cleaned)
            .Where((_, i) => i % 2 == 0) // Split keeps captured separators at odd indexes
            .Select(p => Spaces.Replace(Salts.Replace(p, " ").Trim().ToLowerInvariant(), " ").Trim())
            .Where(p => p.Length > 0)
            .Distinct()
            .ToList();
    }
}
