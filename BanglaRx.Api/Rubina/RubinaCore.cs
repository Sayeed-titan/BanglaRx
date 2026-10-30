using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BanglaRx.Api.Booking;
using BanglaRx.Api.Data;
using BanglaRx.Api.PatientApp;
using Dapper;
using Npgsql;

namespace BanglaRx.Api.Rubina;

/// <summary>Limits for the public chat. Anyone on the internet can reach it, so every one of these matters.</summary>
public class RubinaOptions
{
    public int MaxChars { get; set; } = 500;
    public int PerIpPer10Min { get; set; } = 20;
    /// <summary>Total patient messages answered per day across all visitors (a cost ceiling).</summary>
    public int DailyMessageCap { get; set; } = 2000;
    /// <summary>How many earlier messages the model sees.</summary>
    public int HistoryMessages { get; set; } = 12;
}

public static class RubinaSchema
{
    public static async Task EnsureAsync(IDbConnectionFactory f)
    {
        try
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            await db.ExecuteAsync(@"
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id BIGSERIAL PRIMARY KEY,
                    token VARCHAR(40) NOT NULL UNIQUE,
                    channel VARCHAR(20) NOT NULL DEFAULT 'web',
                    status VARCHAR(20) NOT NULL DEFAULT 'rubina' CHECK (status IN ('rubina','needs_human','human','booked')),
                    handled_by VARCHAR(100),
                    facts JSONB NOT NULL DEFAULT '{}'::jsonb,
                    ip TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id BIGSERIAL PRIMARY KEY,
                    conversation_id BIGINT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
                    sender VARCHAR(10) NOT NULL CHECK (sender IN ('patient','rubina','staff')),
                    body TEXT NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_chat_msgs ON chat_messages (conversation_id, id);
                CREATE INDEX IF NOT EXISTS idx_chat_conv_status ON chat_conversations (status, last_message_at DESC);
                CREATE INDEX IF NOT EXISTS idx_chat_conv_ip ON chat_conversations (ip);
            ");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Rubina Schema Note]: {ex.Message}");
        }
    }
}

/// <summary>Fixed rules, not the model: words that mean "go to an emergency department now". A false alarm costs a sentence; a miss could cost a life.</summary>
public static class RedFlags
{
    private static readonly string[] Words =
    {
        // Bangla
        "বুকে ব্যথা", "বুকে চাপ", "বুক ব্যথা", "বুকে যন্ত্রণা", "শ্বাসকষ্ট", "শ্বাস নিতে পারছে", "শ্বাস নিতে পারছি", "নিঃশ্বাস নিতে", "অজ্ঞান", "জ্ঞান হারিয়ে", "খিঁচুনি", "খিচুনি",
        "রক্তবমি", "রক্ত বমি", "প্রচুর রক্ত", "রক্তপাত বন্ধ হচ্ছে না", "রক্ত বন্ধ হচ্ছে না", "বিষ খে", "বিষ পান", "আত্মহত্যা", "সাপে কাট", "মুখ বেঁকে", "কথা জড়িয়ে",
        "প্রসব ব্যথা", "বাচ্চা নড়ছে না", "নড়াচড়া নেই",
        // English
        "chest pain", "chest pressure", "chest tightness", "can't breathe", "cannot breathe", "trouble breathing", "difficulty breathing", "shortness of breath", "unconscious", "fainted",
        "seizure", "convulsion", "vomiting blood", "coughing blood", "heavy bleeding", "severe bleeding", "bleeding won't stop", "poison", "overdose", "suicide", "kill myself", "snake bite",
        "stroke", "face drooping", "slurred speech", "labour pain", "labor pain", "not moving", "stopped breathing",
    };

    public static bool Detect(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var t = text.ToLowerInvariant();
        return Words.Any(w => t.Contains(w));
    }

    public static bool IsBangla(string? text) => text is not null && Regex.IsMatch(text, @"[ঀ-৿]");

    public static string Message(bool bangla) => bangla
        ? "এটি জরুরি হতে পারে। অপেক্ষা না করে এখনই নিকটতম হাসপাতালের জরুরি বিভাগে যান বা ৯৯৯ এ কল করুন। বুকিংয়ের জন্য সময় নষ্ট করবেন না। এটি রোগ নির্ণয় নয়, সতর্ক থাকার পরামর্শ।"
        : "This could be an emergency. Please go to the nearest hospital emergency department now, or call 999. Do not spend time on booking. This is not a diagnosis, only a warning to be careful.";
}

public class RubinaResult
{
    public string Reply { get; set; } = "";
    public string? Specialty { get; set; }
    public List<int> DoctorIds { get; set; } = new();
    public bool WantsHuman { get; set; }
    public Dictionary<string, string> Facts { get; set; } = new();
}

/// <summary>Rubina, the public booking helper. It only knows the clinic's own doctors, schedules and fees, and it never diagnoses or names medicines.</summary>
public class RubinaService
{
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    public RubinaService(IConfiguration config, IHttpClientFactory http) { _config = config; _http = http; }

    public bool Configured => !string.IsNullOrWhiteSpace(_config["Gemini:ApiKey"]);

    public static string Fallback(bool bangla) => bangla
        ? "দুঃখিত, এই মুহূর্তে আমি উত্তর দিতে পারছি না। নিচের বাটনে চাপ দিয়ে রিসেপশনের একজন মানুষের সাথে কথা বলতে পারেন।"
        : "Sorry, I can't answer right now. Please use the button below to talk to a person at reception.";

    public async Task<RubinaResult?> AskAsync(IReadOnlyList<(string Sender, string Body)> history, string userText, IReadOnlyList<DoctorCardOut> doctors, string today)
    {
        if (!Configured) return null;
        var bangla = RedFlags.IsBangla(userText) || history.Any(h => h.Sender == "patient" && RedFlags.IsBangla(h.Body));

        var doctorLines = doctors.Select(d => new
        {
            id = d.Id, name = d.Name, specialty = d.Specialization, degrees = d.Degrees, place = d.HospitalName,
            fee = d.ConsultationFee, nextFree = d.NextFree is null ? null : $"{d.NextFree.Date} {d.NextFree.Time} at {d.NextFree.Branch}",
        });

        var system = $@"You are Rubina, the booking helper for a clinic in Bangladesh. You help a visitor find which doctor to see, where and when, and you answer questions about the clinic.
HARD RULES:
- You are NOT a doctor. Never diagnose, never name a medicine or a dose, never say a condition is or is not serious.
- Suggest a specialty ONLY from the specialties in DOCTORS below, and doctors ONLY by their id from DOCTORS. If no doctor fits, say so honestly and offer to connect reception. Never invent a doctor, fee, time, address or phone number. If a fact is not in DOCTORS, say you do not have it and offer reception.
- Ask at most one or two short questions: who is the patient (age, if a child), and what is the main problem. Then suggest.
- If the visitor describes chest pain, breathing trouble, fainting, heavy bleeding, seizures, poisoning or similar, tell them to go to an emergency department or call 999 and do not talk about booking.
- Keep replies to 1-3 short sentences. Reply in {(bangla ? "Bangla" : "English")} unless the visitor clearly writes in another language.
- If the visitor wants a person, set wantsHuman true.
Today (clinic time) is {today}. Dates in nextFree are exact: say ""today"" only if the date equals today, ""tomorrow"" only if it is the next day, otherwise give the date.
DOCTORS (live data): {JsonSerializer.Serialize(doctorLines)}
Return JSON only: {{""reply"": string, ""specialty"": string|null, ""doctorIds"": [int], ""wantsHuman"": bool, ""facts"": {{""concern"": string, ""forWhom"": string}}}}. Put in facts only what the visitor actually said; leave a field as an empty string if not said.";

        var dialogue = new StringBuilder();
        foreach (var (sender, body) in history) dialogue.AppendLine($"{(sender == "patient" ? "Visitor" : sender == "rubina" ? "Rubina" : "Reception")}: {body}");
        dialogue.AppendLine($"Visitor: {userText}");

        var model = _config["Gemini:Model"] ?? "gemini-3.5-flash-lite";
        var key = _config["Gemini:ApiKey"];
        var payload = new
        {
            contents = new[] { new { parts = new[] { new { text = $"{system}\n\nConversation so far:\n{dialogue}\nReply as Rubina, JSON only:" } } } },
            generationConfig = new { response_mime_type = "application/json", temperature = 0.3 },
        };
        try
        {
            var client = _http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.Add("x-goog-api-key", key); // header, not URL: URLs end up in logs
            var res = await client.PostAsync($"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));
            if (!res.IsSuccessStatusCode) return null;
            using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
            var raw = doc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(raw)) return null;
            using var j = JsonDocument.Parse(raw);
            var root = j.RootElement;
            var result = new RubinaResult { Reply = root.TryGetProperty("reply", out var r) ? r.GetString() ?? "" : "" };
            if (string.IsNullOrWhiteSpace(result.Reply)) return null;
            var ids = doctors.Select(d => d.Id).ToHashSet();
            if (root.TryGetProperty("doctorIds", out var di) && di.ValueKind == JsonValueKind.Array)
                foreach (var e in di.EnumerateArray()) if (e.ValueKind == JsonValueKind.Number && ids.Contains(e.GetInt32()) && !result.DoctorIds.Contains(e.GetInt32())) result.DoctorIds.Add(e.GetInt32());
            result.DoctorIds = result.DoctorIds.Take(3).ToList();
            // a specialty is only believed if one of our doctors really has it
            if (root.TryGetProperty("specialty", out var sp) && sp.ValueKind == JsonValueKind.String)
            {
                var s = sp.GetString();
                result.Specialty = doctors.Select(d => d.Specialization).FirstOrDefault(x => string.Equals(x, s, StringComparison.OrdinalIgnoreCase));
            }
            result.WantsHuman = root.TryGetProperty("wantsHuman", out var wh) && wh.ValueKind == JsonValueKind.True;
            if (root.TryGetProperty("facts", out var fa) && fa.ValueKind == JsonValueKind.Object)
                foreach (var p in fa.EnumerateObject()) if (p.Value.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(p.Value.GetString())) result.Facts[p.Name] = p.Value.GetString()!;
            return result;
        }
        catch
        {
            return null;
        }
    }
}

public record ChatIn(string? Token, string? Text);
public record ReplyIn(string? Text);
public class ChatMessageView
{
    public long Id { get; set; }
    public string Sender { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
public class ConversationRow
{
    public long Id { get; set; }
    public string Token { get; set; } = "";
    public string Channel { get; set; } = "";
    public string Status { get; set; } = "";
    public string? HandledBy { get; set; }
    public string Facts { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime LastMessageAt { get; set; }
}

public static class RubinaEndpoints
{
    private static IResult Fail(int status, string message) => Results.Json(new { errors = new[] { message } }, statusCode: status);

    private static async Task<List<ChatMessageView>> MessagesAsync(NpgsqlConnection db, long convId, long after = 0) =>
        (await db.QueryAsync<ChatMessageView>(
            "SELECT id AS Id, sender AS Sender, body AS Body, created_at AS CreatedAt FROM chat_messages WHERE conversation_id = @convId AND id > @after ORDER BY id;",
            new { convId, after })).ToList();

    private static Task<long> AddAsync(NpgsqlConnection db, long convId, string sender, string body) =>
        db.ExecuteScalarAsync<long>(@"
            UPDATE chat_conversations SET last_message_at = now() WHERE id = @convId;
            INSERT INTO chat_messages (conversation_id, sender, body) VALUES (@convId, @sender, @body) RETURNING id;", new { convId, sender, body });

    private static Task MergeFactsAsync(NpgsqlConnection db, long convId, Dictionary<string, string> facts) =>
        facts.Count == 0 ? Task.CompletedTask : db.ExecuteAsync("UPDATE chat_conversations SET facts = facts || @facts::jsonb WHERE id = @convId;", new { convId, facts = JsonSerializer.Serialize(facts) });

    private static Task<ConversationRow?> FindAsync(NpgsqlConnection db, string token) =>
        db.QueryFirstOrDefaultAsync<ConversationRow>(
            "SELECT id AS Id, token AS Token, channel AS Channel, status AS Status, handled_by AS HandledBy, facts::text AS Facts, created_at AS CreatedAt, last_message_at AS LastMessageAt FROM chat_conversations WHERE token = @token;", new { token });

    private const string HumanNoticeBn = "আমি রিসেপশনকে জানিয়েছি। একজন মানুষ শীঘ্রই আপনার সাথে কথা বলবেন।";
    private const string HumanNoticeEn = "I have told reception. A person will talk to you shortly.";

    public static void MapRubinaEndpoints(this IEndpointRouteBuilder app)
    {
        // ---- public: no sign-in ----
        var pub = app.MapGroup("/api/public").WithTags("Public");

        pub.MapGet("/doctors", async (IDbConnectionFactory f, ClinicClock clock) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            return Results.Ok(await PatientAppEndpoints.DoctorCardsAsync(db, clock));
        });

        pub.MapPost("/chat", async (ChatIn req, HttpContext ctx, IDbConnectionFactory f, ClinicClock clock, RubinaService rubina, RubinaOptions opt) =>
        {
            var text = (req.Text ?? "").Trim();
            if (text.Length == 0) return Fail(400, "Type a message first.");
            if (text.Length > opt.MaxChars) return Fail(400, $"Please keep a message under {opt.MaxChars} characters.");
            var ip = ctx.Connection.RemoteIpAddress?.ToString();
            var bangla = RedFlags.IsBangla(text);

            using var db = f.CreateConnection();
            await db.OpenAsync();

            var conv = string.IsNullOrWhiteSpace(req.Token) ? null : await FindAsync(db, req.Token);
            if (await db.ExecuteScalarAsync<int>(@"
                SELECT count(*) FROM chat_messages m JOIN chat_conversations c ON c.id = m.conversation_id
                WHERE c.ip = @ip AND m.sender = 'patient' AND m.created_at > now() - interval '10 minutes';", new { ip }) >= opt.PerIpPer10Min)
                return Fail(429, bangla ? "অনেক বেশি মেসেজ পাঠানো হয়েছে। কয়েক মিনিট পরে আবার চেষ্টা করুন।" : "Too many messages. Please wait a few minutes and try again.");
            if (await db.ExecuteScalarAsync<int>("SELECT count(*) FROM chat_messages WHERE sender = 'patient' AND created_at > date_trunc('day', now());") >= opt.DailyMessageCap)
                return Fail(503, bangla ? "আমরা এখন খুব ব্যস্ত। রিসেপশনে ফোন করুন।" : "We are very busy right now. Please call reception.");

            if (conv is null)
            {
                var token = Guid.NewGuid().ToString("N");
                await db.ExecuteAsync("INSERT INTO chat_conversations (token, channel, ip) VALUES (@token, 'web', @ip);", new { token, ip });
                conv = await FindAsync(db, token);
            }
            var c = conv!;
            var patientMsgId = await AddAsync(db, c.Id, "patient", text);

            var emergency = false;
            List<DoctorCardOut> suggested = new();
            string? specialty = null;

            if (RedFlags.Detect(text))
            {
                emergency = true;
                await AddAsync(db, c.Id, "rubina", RedFlags.Message(bangla));
                await MergeFactsAsync(db, c.Id, new() { ["concern"] = text.Length > 140 ? text[..140] : text, ["redFlag"] = "yes" });
            }
            else if (c.Status is "needs_human" or "human")
            {
                // a person is on it: Rubina stays quiet
            }
            else
            {
                var all = await PatientAppEndpoints.DoctorCardsAsync(db, clock);
                var history = (await MessagesAsync(db, c.Id)).Where(m => m.Id != patientMsgId).TakeLast(opt.HistoryMessages).Select(m => (m.Sender, m.Body)).ToList();
                var answer = await rubina.AskAsync(history, text, all, clock.Today.ToString("yyyy-MM-dd dddd"));
                if (answer is null)
                {
                    await AddAsync(db, c.Id, "rubina", RubinaService.Fallback(bangla));
                }
                else
                {
                    await AddAsync(db, c.Id, "rubina", answer.Reply);
                    var facts = new Dictionary<string, string>(answer.Facts);
                    if (answer.Specialty is not null) facts["specialty"] = answer.Specialty;
                    suggested = all.Where(d => answer.DoctorIds.Contains(d.Id)).ToList();
                    if (suggested.Count > 0) facts["suggestedDoctors"] = string.Join(", ", suggested.Select(d => d.Name));
                    await MergeFactsAsync(db, c.Id, facts);
                    specialty = answer.Specialty;
                    if (answer.WantsHuman)
                    {
                        await db.ExecuteAsync("UPDATE chat_conversations SET status = 'needs_human' WHERE id = @id AND status = 'rubina';", new { id = c.Id });
                        await AddAsync(db, c.Id, "rubina", bangla ? HumanNoticeBn : HumanNoticeEn);
                    }
                }
            }

            var status = (await FindAsync(db, c.Token))!.Status;
            var newMessages = await MessagesAsync(db, c.Id, after: patientMsgId - 1);
            return Results.Ok(new { token = c.Token, status, emergency, specialty, doctors = suggested, messages = newMessages });
        });

        pub.MapGet("/chat/{token}", async (string token, long? after, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var conv = await FindAsync(db, token);
            if (conv is null) return Fail(404, "This chat was not found.");
            return Results.Ok(new { token = conv.Token, status = conv.Status, handledBy = conv.HandledBy, messages = await MessagesAsync(db, conv.Id, after ?? 0) });
        });

        pub.MapPost("/chat/{token}/human", async (string token, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var conv = await FindAsync(db, token);
            if (conv is null) return Fail(404, "This chat was not found.");
            if (conv.Status == "rubina")
            {
                await db.ExecuteAsync("UPDATE chat_conversations SET status = 'needs_human' WHERE id = @id;", new { id = conv.Id });
                var lastPatient = await db.QueryFirstOrDefaultAsync<string>("SELECT body FROM chat_messages WHERE conversation_id = @id AND sender = 'patient' ORDER BY id DESC LIMIT 1;", new { id = conv.Id });
                await AddAsync(db, conv.Id, "rubina", RedFlags.IsBangla(lastPatient) ? HumanNoticeBn : HumanNoticeEn);
            }
            return Results.Ok(new { status = "needs_human" });
        });

        // ---- staff: the reception inbox ----
        var inbox = app.MapGroup("/api/inbox").WithTags("Inbox");

        inbox.MapGet("/", async (string? filter, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            var where = filter == "all" ? "TRUE" : "c.status = 'needs_human' OR (c.status = 'human')";
            var rows = await db.QueryAsync(@$"
                SELECT c.id, c.channel, c.status, c.handled_by, c.facts::text AS facts, c.last_message_at,
                       (SELECT body FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS preview
                FROM chat_conversations c WHERE {where} ORDER BY c.last_message_at DESC LIMIT 100;");
            return Results.Ok(rows.Select(r => new
            {
                id = (long)r.id, channel = (string)r.channel, status = (string)r.status, handledBy = (string?)r.handled_by,
                lastMessageAt = (DateTime)r.last_message_at, preview = (string?)r.preview, facts = JsonDocument.Parse((string)r.facts).RootElement,
            }));
        });

        inbox.MapGet("/{id:long}", async (long id, IDbConnectionFactory f) =>
        {
            using var db = f.CreateConnection();
            await db.OpenAsync();
            var c = await db.QueryFirstOrDefaultAsync<ConversationRow>(
                "SELECT id AS Id, token AS Token, channel AS Channel, status AS Status, handled_by AS HandledBy, facts::text AS Facts, created_at AS CreatedAt, last_message_at AS LastMessageAt FROM chat_conversations WHERE id = @id;", new { id });
            if (c is null) return Fail(404, "That chat was not found.");
            return Results.Ok(new { id = c.Id, channel = c.Channel, status = c.Status, handledBy = c.HandledBy, facts = JsonDocument.Parse(c.Facts).RootElement, messages = await MessagesAsync(db, c.Id) });
        });

        inbox.MapPost("/{id:long}/take", async (long id, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var who = ctx.User.FindFirst("unique_name")?.Value ?? ctx.User.Identity?.Name ?? "Reception";
            using var db = f.CreateConnection();
            var n = await db.ExecuteAsync("UPDATE chat_conversations SET status = 'human', handled_by = @who WHERE id = @id AND status IN ('needs_human','rubina');", new { id, who });
            if (n == 0) return Fail(409, "Someone else is already handling this chat.");
            await db.ExecuteAsync("INSERT INTO chat_messages (conversation_id, sender, body) VALUES (@id, 'staff', @body);", new { id, body = who == "Reception" ? "A person from reception has joined the chat." : $"{who} from reception has joined the chat." });
            return Results.Ok(new { status = "human", handledBy = who });
        });

        inbox.MapPost("/{id:long}/reply", async (long id, ReplyIn req, HttpContext ctx, IDbConnectionFactory f) =>
        {
            var text = (req.Text ?? "").Trim();
            if (text.Length == 0 || text.Length > 1000) return Fail(400, "Type a message (up to 1000 characters).");
            var who = ctx.User.FindFirst("unique_name")?.Value ?? ctx.User.Identity?.Name ?? "Reception";
            using var db = f.CreateConnection();
            var handler = await db.QueryFirstOrDefaultAsync<(string Status, string? HandledBy)?>("SELECT status AS Status, handled_by AS HandledBy FROM chat_conversations WHERE id = @id;", new { id });
            if (handler is null) return Fail(404, "That chat was not found.");
            if (handler.Value.Status != "human") return Fail(409, "Take over the chat before replying.");
            if (handler.Value.HandledBy != who && ctx.User.Identity?.IsAuthenticated == true) return Fail(409, $"{handler.Value.HandledBy} is handling this chat.");
            await AddAsync(db, id, "staff", text);
            return Results.Ok(new { ok = true });
        });
    }
}
