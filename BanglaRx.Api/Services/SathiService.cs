using System.Text;
using System.Text.Json;
using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using BanglaRx.Api.Models.DTOs;
using Dapper;

namespace BanglaRx.Api.Services;

public record SathiTurn(string? Role, string? Text);
public class SathiChatRequest
{
    public int? PatientId { get; set; }
    public string? WeightKg { get; set; }
    public List<SathiTurn>? Messages { get; set; }
    /// <summary>Medicines already on the pad (brand and generic), so interactions with them can be flagged.</summary>
    public List<PrescriptionItem>? PadItems { get; set; }
}
public record SathiCard(string Key, string Generic, string Strength, string Form, string Dose, string Why, List<MedicineOption> Options);
public record SathiReply(string Reply, List<SathiCard> Cards, List<SafetyAlert> Alerts, List<string> NotInFormulary);

/// <summary>
/// Rx সাথী: a question-and-answer assistant for the signed-in doctor. It sees the patient's age, sex, weight, allergies and
/// chronic conditions (never the name or phone). It can only offer medicines that exist in our formulary, allergy conflicts are
/// removed by fixed rules rather than by the model, and it never fills a dose or duration on the pad.
/// </summary>
public class SathiService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    private readonly IDbConnectionFactory _db;
    private readonly IClinicalSafetyService _safety;

    public SathiService(IConfiguration config, IHttpClientFactory http, IDbConnectionFactory db, IClinicalSafetyService safety)
    {
        _config = config; _http = http; _db = db; _safety = safety;
    }

    private record Proposal(string Name, string Strength, string Form, string Dose, string Why);

    public async Task<SathiReply?> AskAsync(SathiChatRequest req)
    {
        var key = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(key)) return null;
        var turns = (req.Messages ?? new()).Where(m => !string.IsNullOrWhiteSpace(m.Text)).TakeLast(10).ToList();
        if (turns.Count == 0 || turns[^1].Role != "user") return null;

        using var db = _db.CreateConnection();
        Patient? p = req.PatientId is int pid ? await db.QuerySingleOrDefaultAsync<Patient>("SELECT * FROM patients WHERE id = @pid;", new { pid }) : null;
        var context = p is null
            ? "No patient is selected."
            : $"Patient: {p.age} years, {p.gender}. Weight: {(string.IsNullOrWhiteSpace(req.WeightKg) ? "not recorded" : req.WeightKg + " kg")}. Allergies: {(string.IsNullOrWhiteSpace(p.allergies) ? "not recorded" : p.allergies)}. Chronic conditions: {(string.IsNullOrWhiteSpace(p.chronic_conditions) ? "not recorded" : p.chronic_conditions)}.";
        var pad = (req.PadItems ?? new()).Where(i => !string.IsNullOrWhiteSpace(i.BrandName)).Select(i => $"{i.BrandName} ({i.GenericName})").ToList();

        var system = $@"You are Rx Sathi, a clinical decision-support assistant for a registered physician in Bangladesh. The doctor decides; you only help.
RULES:
- Answer in the language the doctor writes in (Bangla or English), in at most 4 short sentences.
- Use ONLY the patient facts given below. If a fact you need (weight, allergy, age) is not recorded, say so and ask; never assume it.
- Never invent test results, vitals or history. If you are unsure, say you are unsure.
- When the doctor asks what to give, propose up to 3 medicines by GENERIC name with strength and form, a short typical dose in words, and a one-line reason. Do not propose a medicine the patient is allergic to. Mention important cautions in the reply.
- Every medicine you mention by name in the reply must also appear in the medicines list. Quote the patient's numbers (age, weight) exactly as given.
- If the doctor is only asking a question (interaction, dose check, explanation), propose no medicines.
- Doses are suggestions for the doctor to verify. Say when a dose depends on weight or kidney function.
PATIENT CONTEXT: {context}
ALREADY ON THE PAD: {(pad.Count == 0 ? "nothing" : string.Join("; ", pad))}
Return JSON only: {{""reply"": string, ""medicines"": [{{""name"": generic name, ""strength"": e.g. ""500 mg"", ""form"": e.g. ""Tablet"", ""dose"": string, ""why"": string}}]}}";

        var dialogue = new StringBuilder();
        foreach (var t in turns) dialogue.AppendLine($"{(t.Role == "user" ? "Doctor" : "Rx Sathi")}: {t.Text}");

        var model = _config["Gemini:Model"] ?? "gemini-3.5-flash-lite";
        var payload = new
        {
            contents = new[] { new { parts = new[] { new { text = $"{system}\n\nConversation:\n{dialogue}\nReply as Rx Sathi, JSON only:" } } } },
            generationConfig = new { response_mime_type = "application/json", temperature = 0.2 },
        };

        string reply;
        var proposals = new List<Proposal>();
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(25);
            var res = await client.PostAsync($"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            if (!res.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var raw = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            using var j = JsonDocument.Parse(raw);
            reply = j.RootElement.TryGetProperty("reply", out var r) ? r.GetString() ?? "" : "";
            if (string.IsNullOrWhiteSpace(reply)) return null;
            if (j.RootElement.TryGetProperty("medicines", out var ms) && ms.ValueKind == JsonValueKind.Array)
            {
                string S(JsonElement e, string n) => e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
                foreach (var m in ms.EnumerateArray().Take(3))
                    if (!string.IsNullOrWhiteSpace(S(m, "name"))) proposals.Add(new Proposal(S(m, "name"), S(m, "strength"), S(m, "form"), S(m, "dose"), S(m, "why")));
            }
        }
        catch
        {
            return null;
        }

        // Only medicines that exist in the formulary become cards; the rest are named so the doctor knows they were left out.
        var cards = new List<SathiCard>();
        var notIn = new List<string>();
        foreach (var pr in proposals)
        {
            var generic = GenericNames.Components(pr.Name).FirstOrDefault() ?? pr.Name.Trim().ToLowerInvariant();
            var rows = (await db.QueryAsync<Medicine>(
                "SELECT * FROM medicines WHERE lower(generic_name) LIKE @g ORDER BY brand_name LIMIT 60;", new { g = generic + "%" })).ToList();
            var wantNum = new string((pr.Strength ?? "").TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
            var fits = rows.Where(m => (wantNum.Length == 0 || new string(m.strength.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray()) == wantNum)
                                       && (string.IsNullOrWhiteSpace(pr.Form) || m.form.StartsWith(pr.Form, StringComparison.OrdinalIgnoreCase) || pr.Form.StartsWith(m.form, StringComparison.OrdinalIgnoreCase))).ToList();
            if (fits.Count == 0) { notIn.Add($"{pr.Name} {pr.Strength}".Trim()); continue; }
            var options = fits.Take(5).Select(m => new MedicineOption { Id = m.id, BrandName = m.brand_name, GenericName = m.generic_name, Form = m.form, Strength = m.strength }).ToList();
            cards.Add(new SathiCard($"c{cards.Count}", fits[0].generic_name, fits[0].strength, fits[0].form, pr.Dose, pr.Why, options));
        }

        // Fixed-rule safety on what we are about to show, together with what is already on the pad.
        var alerts = new List<SafetyAlert>();
        if (cards.Count > 0)
        {
            var candidate = cards.Select(c => new PrescriptionItem { BrandName = c.Options[0].BrandName, GenericName = c.Generic, Form = c.Form, Strength = c.Strength }).ToList();
            var all = candidate.Concat(req.PadItems ?? new()).ToList();
            var found = await _safety.CheckAsync(new SafetyCheckRequest { Allergies = p?.allergies, Age = p?.age, WeightKg = req.WeightKg, Items = all });
            var blocked = found.Where(a => a.Type == "allergy").SelectMany(a => a.Drugs).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var removed = cards.Where(c => blocked.Contains(c.Options[0].BrandName)).ToList();
            cards = cards.Where(c => !blocked.Contains(c.Options[0].BrandName)).ToList();
            foreach (var rc in removed)
                alerts.Add(new SafetyAlert("allergy", "critical", $"Left out: {rc.Generic}", $"The patient has a recorded allergy that covers {rc.Generic}, so it was not offered.", new List<string> { rc.Generic }));
            // interactions or duplicates with the pad are shown, not hidden: the doctor decides
            alerts.AddRange(found.Where(a => a.Type is "interaction" or "duplicate"));
        }
        return new SathiReply(reply.Trim(), cards, alerts, notIn);
    }
}
