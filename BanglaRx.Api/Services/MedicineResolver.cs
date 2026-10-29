using System.Data;
using System.Text.RegularExpressions;
using BanglaRx.Api.Models.Domain;
using Dapper;

namespace BanglaRx.Api.Services;

/// <summary>
/// Maps what the AI heard ("Seclo", "Napa 500", "Omeprazole") to ONE formulary row, strength-aware.
/// When it can't be sure it returns options for the doctor to pick instead of guessing.
/// </summary>
public static class MedicineResolver
{
    public const string Exact = "exact";
    public const string Ambiguous = "ambiguous";
    public const string Fuzzy = "fuzzy";
    public const string StrengthUnavailable = "strength_unavailable";
    public const string Unmatched = "unmatched";

    private static readonly Regex Number = new(@"\d+(\.\d+)?", RegexOptions.Compiled);

    public static async Task<PrescriptionItem> ResolveAsync(IDbConnection db, PrescriptionItem item, IReadOnlyList<Medicine> candidates)
    {
        var brand = (item.BrandName ?? "").Trim();
        var result = new PrescriptionItem
        {
            BrandName = string.IsNullOrWhiteSpace(brand) ? "Unspecified" : brand,
            GenericName = item.GenericName ?? "",
            Form = item.Form ?? "",
            Strength = item.Strength ?? "",
            DosagePattern = item.DosagePattern ?? "",
            Duration = item.Duration ?? "",
            InstructionsBangla = item.InstructionsBangla ?? "",
            MatchStatus = Unmatched
        };
        if (string.IsNullOrWhiteSpace(brand) && string.IsNullOrWhiteSpace(item.GenericName)) return result;

        var firstWord = brand.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";

        // Pool = AI candidates + every brand in the same family (same first word), fetched fresh from the DB
        var pool = candidates.ToDictionary(m => m.id);
        if (firstWord.Length >= 2)
        {
            var family = await db.QueryAsync<Medicine>(
                "SELECT * FROM medicines WHERE brand_name ILIKE @p LIMIT 40;", new { p = firstWord + "%" });
            foreach (var m in family) pool[m.id] = m;
        }

        var sameFamily = pool.Values
            .Where(m => string.Equals(FirstWord(m.brand_name), firstWord, StringComparison.OrdinalIgnoreCase))
            .ToList();

        // 1. Whole brand name matches exactly ("Seclo 20", "Napa Extra")
        var exact = pool.Values.Where(m => string.Equals(Norm(m.brand_name), Norm(brand), StringComparison.OrdinalIgnoreCase)).ToList();
        if (exact.Count == 1) return Apply(result, exact[0], Exact);

        // 2. Same family: narrow by the number spoken in the brand ("Seclo 20") or in the strength field ("20mg")
        if (sameFamily.Count > 0)
        {
            var wanted = new List<string>();
            wanted.AddRange(Number.Matches(brand.Substring(Math.Min(firstWord.Length, brand.Length))).Select(x => x.Value));
            if (!string.IsNullOrWhiteSpace(item.Strength))
                wanted.Add(Number.Match(item.Strength).Value);
            wanted = wanted.Where(w => w.Length > 0).Distinct().ToList();

            if (wanted.Count > 0)
            {
                var byNumber = sameFamily.Where(m => wanted.Any(w => HasNumber(m.brand_name, w) || HasNumber(m.strength, w))).ToList();
                if (byNumber.Count == 1) return Apply(result, byNumber[0], Exact);
                if (byNumber.Count > 1) return WithOptions(result, byNumber, Ambiguous);
                // Number spoken but no such variant in the formulary -> show what exists, don't substitute
                return WithOptions(result, sameFamily, StrengthUnavailable);
            }

            // No number given: a family with a single variant is unambiguous
            if (sameFamily.Count == 1) return Apply(result, sameFamily[0], Exact);

            // "Napa" when "Napa" itself exists as a plain brand is the exact one (not Napa Extra)
            var plain = sameFamily.Where(m => string.Equals(Norm(m.brand_name), Norm(firstWord), StringComparison.OrdinalIgnoreCase)).ToList();
            if (plain.Count == 1 && string.Equals(Norm(brand), Norm(firstWord), StringComparison.OrdinalIgnoreCase))
                return Apply(result, plain[0], Exact);

            return WithOptions(result, sameFamily, Ambiguous);
        }

        // 3. Spoken by generic name only ("Omeprazole") -> doctor picks the brand
        if (!string.IsNullOrWhiteSpace(item.GenericName) || !string.IsNullOrWhiteSpace(brand))
        {
            var g = !string.IsNullOrWhiteSpace(item.GenericName) ? item.GenericName! : brand;
            var byGeneric = (await db.QueryAsync<Medicine>(
                "SELECT * FROM medicines WHERE generic_name ILIKE @g ORDER BY brand_name LIMIT 8;", new { g })).ToList();
            if (byGeneric.Count > 0) return WithOptions(result, byGeneric, Ambiguous);
        }

        // 4. Typo / transliteration -> closest brands, flagged for the doctor to confirm
        if (brand.Length >= 3)
        {
            var close = (await db.QueryAsync<Medicine>(@"
                SELECT * FROM medicines WHERE similarity(brand_name, @b) > 0.35
                ORDER BY similarity(brand_name, @b) DESC LIMIT 4;", new { b = brand })).ToList();
            if (close.Count > 0) return WithOptions(result, close, Fuzzy);
        }

        return result; // Unmatched: keep exactly what was heard
    }

    private static PrescriptionItem Apply(PrescriptionItem r, Medicine m, string status)
    {
        r.MedicineId = m.id;
        r.BrandName = m.brand_name;
        r.GenericName = m.generic_name;
        r.Form = m.form;
        r.Strength = m.strength;
        r.MatchStatus = status;
        return r;
    }

    private static PrescriptionItem WithOptions(PrescriptionItem r, IEnumerable<Medicine> options, string status)
    {
        r.MatchStatus = status;
        r.MatchOptions = options.Take(6).Select(m => new MedicineOption
        {
            Id = m.id, BrandName = m.brand_name, GenericName = m.generic_name, Form = m.form, Strength = m.strength
        }).ToList();
        return r;
    }

    private static string FirstWord(string s) => s.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
    private static string Norm(string s) => Regex.Replace(s.ToLowerInvariant(), @"\s+", " ").Trim();
    private static bool HasNumber(string s, string n) => Number.Matches(s).Any(x => x.Value == n);
}
