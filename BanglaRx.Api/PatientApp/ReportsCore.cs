using System.Text;
using System.Text.Json;
using BanglaRx.Api.Data;
using Dapper;

namespace BanglaRx.Api.PatientApp;

public class ReportValue
{
    public string Name { get; set; } = "";
    public string Value { get; set; } = "";
    public string Unit { get; set; } = "";
    /// <summary>clear, or unclear when the photo was too blurry to be sure of the digits.</summary>
    public string Confidence { get; set; } = "clear";
}
public class ReadReportInput
{
    public int? ProfileId { get; set; }
    public string? MimeType { get; set; }
    public string? ImageBase64 { get; set; }
}
public class SaveReportInput
{
    public int? ProfileId { get; set; }
    public string? Kind { get; set; }
    public string? TakenOn { get; set; }
    public List<ReportValue>? Values { get; set; }
}

public static class ReportSchema
{
    public static async Task EnsureAsync(IDbConnectionFactory f)
    {
        try
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            await db.ExecuteAsync(@"
                -- Only values the patient has checked and confirmed are kept, and only when they allowed it. The photo itself is never stored.
                CREATE TABLE IF NOT EXISTS patient_reports (
                    id BIGSERIAL PRIMARY KEY,
                    account_id INT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
                    patient_id INT NOT NULL REFERENCES patients(id),
                    kind VARCHAR(80) NOT NULL DEFAULT 'Lab report',
                    taken_on DATE,
                    report_values JSONB NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_patient_reports_patient ON patient_reports (patient_id, created_at DESC);
                -- one row per photo read, so one account cannot run up the AI bill
                CREATE TABLE IF NOT EXISTS patient_report_reads (
                    id BIGSERIAL PRIMARY KEY,
                    account_id INT NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Report Schema Note]: {ex.Message}");
        }
    }
}

/// <summary>Reads the values printed on a photographed lab report. It reads; it never interprets, so there is no "normal" or "abnormal".</summary>
public class ReportReader
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    public ReportReader(IConfiguration config, IHttpClientFactory http) { _config = config; _http = http; }

    public record Result(string Kind, string? TakenOn, List<ReportValue> Values);

    public async Task<Result?> ReadAsync(string mime, string base64)
    {
        var key = _config["Gemini:ApiKey"];
        if (string.IsNullOrWhiteSpace(key)) return null;
        var model = _config["Gemini:Model"] ?? "gemini-3.5-flash-lite";
        var prompt = @"This is a photo of a medical report or lab result from Bangladesh. Copy the test results that are printed on it.
RULES:
- Copy only values that are printed. Never calculate, never fill in a missing value, never guess a digit.
- For each result give: name (as printed), value (as printed, text), unit (as printed, or empty), confidence: ""clear"" if every character is sharp, ""unclear"" if any digit is blurry, cut off, handwritten or ambiguous. For an unclear digit write what you can read and put ? in its place, for example 3?.
- Do NOT say whether a value is normal, high or low. Do NOT add advice or a diagnosis.
- kind: a short title of the report as printed (for example ""HbA1c"" or ""Complete Blood Count""). takenOn: the report date as YYYY-MM-DD if printed, otherwise null.
- If the picture is not a medical report, return kind ""not_a_report"" and an empty values list.
Return JSON only: {""kind"": string, ""takenOn"": string|null, ""values"": [{""name"": string, ""value"": string, ""unit"": string, ""confidence"": ""clear""|""unclear""}]}";
        var payload = new
        {
            contents = new[] { new { parts = new object[] { new { text = prompt }, new { inline_data = new { mime_type = mime, data = base64 } } } } },
            generationConfig = new { response_mime_type = "application/json", temperature = 0.0 },
        };
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(45);
            var res = await client.PostAsync($"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}",
                new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            if (!res.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var raw = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            using var j = JsonDocument.Parse(raw);
            var root = j.RootElement;
            string S(JsonElement e, string n) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";
            var kind = S(root, "kind");
            var takenOn = S(root, "takenOn");
            var values = new List<ReportValue>();
            if (root.TryGetProperty("values", out var vs) && vs.ValueKind == JsonValueKind.Array)
                foreach (var v in vs.EnumerateArray().Take(60))
                {
                    var name = S(v, "name").Trim();
                    var value = S(v, "value").Trim();
                    if (name.Length == 0 || value.Length == 0) continue;
                    var unclear = S(v, "confidence") == "unclear" || value.Contains('?');
                    values.Add(new ReportValue { Name = Clip(name, 80), Value = Clip(value, 40), Unit = Clip(S(v, "unit").Trim(), 20), Confidence = unclear ? "unclear" : "clear" });
                }
            return new Result(string.IsNullOrWhiteSpace(kind) ? "Lab report" : Clip(kind, 80), DateTime.TryParse(takenOn, out var d) ? d.ToString("yyyy-MM-dd") : null, values);
        }
        catch
        {
            return null;
        }
    }

    private static string Clip(string s, int n) => s.Length <= n ? s : s[..n];
}

public static class PatientReportEndpoints
{
    private static IResult Fail(int status, string message) => Results.Json(new { errors = new[] { message } }, statusCode: status);
    private static readonly string[] Mimes = { "image/jpeg", "image/png", "image/webp" };

    private static async Task<bool> OwnsProfile(Npgsql.NpgsqlConnection db, int accountId, int profileId) =>
        await db.ExecuteScalarAsync<bool>("SELECT EXISTS (SELECT 1 FROM patient_account_profiles WHERE account_id = @a AND patient_id = @p);", new { a = accountId, p = profileId });

    public static void Map(RouteGroupBuilder g)
    {
        // 1. read a photo: nothing is saved here, the patient checks the values first
        g.MapPost("/reports/read", async (ReadReportInput req, HttpContext ctx, IDbConnectionFactory f, ReportReader reader) =>
        {
            var me = PatientAppEndpoints.CurrentAccount(ctx);
            if (req.ProfileId is null) return Fail(400, "Choose who the report is for.");
            if (req.MimeType is null || !Mimes.Contains(req.MimeType)) return Fail(400, "Please send a JPEG, PNG or WebP photo.");
            if (string.IsNullOrWhiteSpace(req.ImageBase64) || req.ImageBase64.Length > 6_000_000) return Fail(400, "The photo is empty or too large. Try a smaller photo.");
            using var db = f.CreateConnection();
            await db.OpenAsync();
            if (!await OwnsProfile(db, me.Id, req.ProfileId.Value)) return Fail(403, "That person is not on your account.");
            if (await db.ExecuteScalarAsync<int>("SELECT count(*) FROM patient_report_reads WHERE account_id = @a AND created_at > now() - interval '1 hour';", new { a = me.Id }) >= 10)
                return Fail(429, "You have read many reports in the last hour. Please try again a little later.");
            await db.ExecuteAsync("INSERT INTO patient_report_reads (account_id) VALUES (@a);", new { a = me.Id });
            var result = await reader.ReadAsync(req.MimeType, req.ImageBase64);
            if (result is null) return Fail(503, "We could not read the photo just now. Please try again.");
            if (result.Kind == "not_a_report" || result.Values.Count == 0) return Fail(422, "We could not find test results in this photo. Take a clear, flat photo of the whole report.");
            return Results.Ok(result);
        });

        // 2. keep what the patient checked, but only if they allowed us to keep reports
        g.MapPost("/reports", async (SaveReportInput req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var me = PatientAppEndpoints.CurrentAccount(ctx);
            var values = (req.Values ?? new()).Where(v => !string.IsNullOrWhiteSpace(v.Name) && !string.IsNullOrWhiteSpace(v.Value)).Take(60).ToList();
            if (req.ProfileId is null) return Fail(400, "Choose who the report is for.");
            if (values.Count == 0) return Fail(400, "There are no values to save.");
            if (values.Any(v => v.Value.Contains('?'))) return Fail(400, "Some values still have a ? in them. Please correct them first.");
            using var db = f.CreateConnection();
            await db.OpenAsync();
            if (!await OwnsProfile(db, me.Id, req.ProfileId.Value)) return Fail(403, "That person is not on your account.");
            var allowed = await db.ExecuteScalarAsync<bool?>("SELECT store_reports FROM patient_consents WHERE account_id = @a;", new { a = me.Id }) ?? false;
            if (!allowed) return Results.Ok(new { saved = false, reason = "not_allowed" });
            DateTime? taken = DateTime.TryParse(req.TakenOn, out var d) ? d.Date : null;
            var clean = values.Select(v => new { name = v.Name.Trim(), value = v.Value.Trim(), unit = (v.Unit ?? "").Trim() });
            var id = await db.ExecuteScalarAsync<long>(@"
                INSERT INTO patient_reports (account_id, patient_id, kind, taken_on, report_values)
                VALUES (@a, @p, @kind, @taken, @vals::jsonb) RETURNING id;",
                new { a = me.Id, p = req.ProfileId.Value, kind = string.IsNullOrWhiteSpace(req.Kind) ? "Lab report" : req.Kind.Trim()[..Math.Min(80, req.Kind.Trim().Length)], taken, vals = JsonSerializer.Serialize(clean) });
            return Results.Ok(new { saved = true, id });
        });

        g.MapGet("/reports", async (HttpContext ctx, IDbConnectionFactory f) =>
        {
            var me = PatientAppEndpoints.CurrentAccount(ctx);
            using var db = f.CreateConnection();
            var rows = await db.QueryAsync(@"
                SELECT r.id, r.patient_id, p.full_name AS patient_name, r.kind, to_char(r.taken_on, 'YYYY-MM-DD') AS taken_on, r.created_at, r.report_values::text AS vals
                FROM patient_reports r JOIN patients p ON p.id = r.patient_id
                WHERE r.patient_id IN (SELECT patient_id FROM patient_account_profiles WHERE account_id = @a)
                ORDER BY COALESCE(r.taken_on, r.created_at::date) DESC, r.id DESC LIMIT 100;", new { a = me.Id });
            return Results.Ok(rows.Select(r => new
            {
                id = (long)r.id, profileId = (int)r.patient_id, patientName = (string)r.patient_name, kind = (string)r.kind,
                takenOn = (string?)r.taken_on, createdAt = (DateTime)r.created_at,
                values = JsonDocument.Parse((string)r.vals).RootElement,
            }));
        });

        g.MapPost("/reports/{id:long}/delete", async (long id, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var me = PatientAppEndpoints.CurrentAccount(ctx);
            using var db = f.CreateConnection();
            var n = await db.ExecuteAsync("DELETE FROM patient_reports WHERE id = @id AND account_id = @a;", new { id, a = me.Id });
            return n == 0 ? Fail(404, "That report was not found.") : Results.Ok(new { deleted = true });
        });
    }
}
