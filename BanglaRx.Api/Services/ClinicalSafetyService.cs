using System.Text.RegularExpressions;
using BanglaRx.Api.Models.Domain;
using BanglaRx.Api.Models.DTOs;

namespace BanglaRx.Api.Services;

public interface IClinicalSafetyService
{
    Task<List<SafetyAlert>> CheckAsync(SafetyCheckRequest req);
}

/// <summary>
/// Deterministic prescription safety checks (never LLM-decided): allergy, duplicate therapy,
/// drug-drug interaction, and dose limits by age/weight. Doctor can always override; this only warns.
/// </summary>
public class ClinicalSafetyService : IClinicalSafetyService
{
    private readonly IDrugSafetyService _ddi;

    public ClinicalSafetyService(IDrugSafetyService ddi) => _ddi = ddi;

    // Allergy class -> member active ingredients (starter list; extend with the full formulary later)
    private static readonly Dictionary<string, string[]> AllergyClasses = new(StringComparer.OrdinalIgnoreCase)
    {
        ["penicillin"] = new[] { "penicillin", "amoxicillin", "ampicillin", "cloxacillin", "flucloxacillin", "dicloxacillin", "piperacillin", "benzylpenicillin", "phenoxymethylpenicillin", "clavulanic acid" },
        ["cephalosporin"] = new[] { "cefixime", "cefuroxime", "ceftriaxone", "cefpodoxime", "cefadroxil", "cephalexin", "cefaclor", "cefotaxime", "ceftazidime", "cefepime", "cefdinir", "cefditoren" },
        ["sulfa"] = new[] { "sulfamethoxazole", "co-trimoxazole", "cotrimoxazole", "sulfasalazine", "sulfadiazine", "trimethoprim" },
        ["nsaid"] = new[] { "ibuprofen", "diclofenac", "naproxen", "ketorolac", "aceclofenac", "etoricoxib", "celecoxib", "mefenamic acid", "piroxicam", "indomethacin", "aspirin", "flurbiprofen", "ketoprofen" },
        ["aspirin"] = new[] { "aspirin" },
        ["macrolide"] = new[] { "azithromycin", "clarithromycin", "erythromycin", "roxithromycin" },
        ["fluoroquinolone"] = new[] { "ciprofloxacin", "levofloxacin", "ofloxacin", "moxifloxacin", "norfloxacin", "gatifloxacin" },
    };

    private static readonly string[] AllergyAliases = { "penicillins", "sulfonamide", "sulphonamide", "sulpha", "nsaids", "cephalosporins", "quinolone" };
    private static readonly Dictionary<string, string> AliasToClass = new(StringComparer.OrdinalIgnoreCase)
    {
        ["penicillins"] = "penicillin", ["sulfonamide"] = "sulfa", ["sulphonamide"] = "sulfa", ["sulpha"] = "sulfa",
        ["nsaids"] = "nsaid", ["cephalosporins"] = "cephalosporin", ["quinolone"] = "fluoroquinolone"
    };

    private static readonly string[] NoAllergyMarkers = { "none", "none reported", "not recorded", "nil", "no", "n/a", "na", "-" };

    // Max total daily dose. perKg applies when weight known (children); absoluteMg is the adult ceiling.
    private record DoseLimit(double? PerKgPerDay, double AbsoluteMgPerDay);
    private static readonly Dictionary<string, DoseLimit> DoseLimits = new(StringComparer.OrdinalIgnoreCase)
    {
        ["paracetamol"] = new(60, 4000),
        ["ibuprofen"] = new(40, 2400),
    };

    public async Task<List<SafetyAlert>> CheckAsync(SafetyCheckRequest req)
    {
        var alerts = new List<SafetyAlert>();
        var items = (req.Items ?? new List<PrescriptionItem>()).Where(i => !string.IsNullOrWhiteSpace(i.BrandName)).ToList();
        if (items.Count == 0) return alerts;

        var comps = items.Select(i => GenericNames.Components(i.GenericName)).ToList();

        // 1. Allergy
        foreach (var term in ParseAllergies(req.Allergies))
        {
            var members = AllergyClasses.TryGetValue(term, out var m) ? m : new[] { term };
            for (int i = 0; i < items.Count; i++)
            {
                var hit = comps[i].FirstOrDefault(c => members.Any(x => c == x || c.StartsWith(x + " ")));
                if (hit != null)
                {
                    alerts.Add(new SafetyAlert(
                        "allergy", "critical",
                        $"Allergy: {items[i].BrandName} ({hit})",
                        $"Patient has a recorded allergy to \"{term}\". {items[i].BrandName} contains {hit}.",
                        new List<string> { items[i].BrandName }));
                }
            }
        }

        // 2. Duplicate therapy (same active ingredient in two lines)
        for (int i = 0; i < items.Count; i++)
        {
            for (int j = i + 1; j < items.Count; j++)
            {
                var shared = comps[i].Intersect(comps[j]).ToList();
                if (shared.Count > 0)
                {
                    alerts.Add(new SafetyAlert(
                        "duplicate", "major",
                        $"Duplicate: {string.Join(", ", shared)}",
                        $"{items[i].BrandName} and {items[j].BrandName} both contain {string.Join(", ", shared)}. Risk of double dosing.",
                        new List<string> { items[i].BrandName, items[j].BrandName }));
                }
            }
        }

        // 3. Drug-drug interactions (exact ingredient match)
        var ddi = await _ddi.CheckInteractionsAsync(items.Select(i => i.GenericName));
        foreach (var w in ddi)
        {
            alerts.Add(new SafetyAlert(
                "interaction", ((string)w.Severity).ToLowerInvariant(),
                $"Interaction: {w.DrugA} + {w.DrugB}",
                $"{w.Description} {w.ClinicalAdvice}",
                new List<string> { (string)w.DrugA, (string)w.DrugB }));
        }

        // 4. Dose limits + paediatric flags
        var weight = ParseNumber(req.WeightKg);
        var isChild = req.Age.HasValue && req.Age.Value < 12;

        for (int i = 0; i < items.Count; i++)
        {
            var it = items[i];

            if (req.Age.HasValue && req.Age.Value < 16 && comps[i].Contains("aspirin"))
            {
                alerts.Add(new SafetyAlert("dose", "major", $"Aspirin in age {req.Age}",
                    "Aspirin is generally avoided under 16 years (risk of Reye syndrome).", new List<string> { it.BrandName }));
            }

            // Only single-ingredient solid forms can be checked reliably
            if (comps[i].Count != 1 || !DoseLimits.TryGetValue(comps[i][0], out var limit)) continue;
            var form = (it.Form ?? "").ToLowerInvariant();
            if (!(form.Contains("tab") || form.Contains("cap"))) continue;

            var perDose = ParseNumber(it.Strength);
            var perDay = DosesPerDay(it.DosagePattern);
            if (perDose == null || perDay == null) continue;

            var totalMg = perDose.Value * perDay.Value;
            if (totalMg > limit.AbsoluteMgPerDay)
            {
                alerts.Add(new SafetyAlert("dose", "major", $"High daily dose: {it.BrandName}",
                    $"{totalMg:0} mg/day of {comps[i][0]} exceeds the {limit.AbsoluteMgPerDay:0} mg/day ceiling.", new List<string> { it.BrandName }));
            }
            else if (isChild && limit.PerKgPerDay.HasValue)
            {
                if (weight == null)
                {
                    alerts.Add(new SafetyAlert("dose", "moderate", $"Child dose not verifiable: {it.BrandName}",
                        "Patient is under 12 and weight is not recorded. Record weight to check the dose.", new List<string> { it.BrandName }));
                }
                else if (totalMg > limit.PerKgPerDay.Value * weight.Value)
                {
                    alerts.Add(new SafetyAlert("dose", "major", $"Child dose too high: {it.BrandName}",
                        $"{totalMg:0} mg/day for {weight:0.#} kg = {totalMg / weight.Value:0} mg/kg/day (limit {limit.PerKgPerDay} mg/kg/day).", new List<string> { it.BrandName }));
                }
            }
        }

        return alerts
            .OrderBy(a => SeverityRank(a.Severity))
            .ToList();
    }

    private static int SeverityRank(string s) => s switch { "critical" => 0, "major" => 1, "moderate" => 2, _ => 3 };

    private static IEnumerable<string> ParseAllergies(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) yield break;
        foreach (var raw in Regex.Split(text, @"[,;/\n]|\band\b|এবং|ও "))
        {
            var t = raw.Trim().ToLowerInvariant();
            if (t.Length < 3 || NoAllergyMarkers.Contains(t)) continue;
            t = Regex.Replace(t, @"\s*(allergy|allergic|hypersensitivity|to)\b", "").Trim();
            if (t.Length < 3) continue;
            yield return AliasToClass.TryGetValue(t, out var cls) ? cls : t;
        }
    }

    private static double? ParseNumber(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return null;
        var m = Regex.Match(s, @"\d+(\.\d+)?");
        return m.Success ? double.Parse(m.Value, System.Globalization.CultureInfo.InvariantCulture) : null;
    }

    /// <summary>"1+0+1" -> 2; "৪ ঘণ্টা পর পর" -> 6; SOS/unknown -> null (not checked).</summary>
    private static double? DosesPerDay(string? pattern)
    {
        if (string.IsNullOrWhiteSpace(pattern)) return null;
        pattern = ToAsciiDigits(pattern);
        var m = Regex.Match(pattern, @"^\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)");
        if (m.Success)
            return double.Parse(m.Groups[1].Value) + double.Parse(m.Groups[2].Value) + double.Parse(m.Groups[3].Value);
        var h = Regex.Match(pattern, @"(\d+)\s*(ঘণ্টা|ঘন্টা|hour|hr)");
        if (h.Success && int.Parse(h.Groups[1].Value) > 0) return 24.0 / int.Parse(h.Groups[1].Value);
        return null;
    }

    private static string ToAsciiDigits(string s) =>
        new string(s.Select(c => c >= '০' && c <= '৯' ? (char)('0' + (c - '০')) : c).ToArray());
}
