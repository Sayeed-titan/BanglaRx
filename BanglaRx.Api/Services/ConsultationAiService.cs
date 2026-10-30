using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using BanglaRx.Api.Models.DTOs;
using Dapper;

namespace BanglaRx.Api.Services;

public interface IConsultationAiService
{
    Task<object> AnalyzeConsultationAsync(ConsultationInput input);
}

public class ConsultationAiService : IConsultationAiService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IDrugSafetyService _drugSafetyService;
    private readonly IClinicalSafetyService _safetyService;

    public ConsultationAiService(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        IDbConnectionFactory connectionFactory,
        IDrugSafetyService drugSafetyService,
        IClinicalSafetyService safetyService)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _connectionFactory = connectionFactory;
        _drugSafetyService = drugSafetyService;
        _safetyService = safetyService;
    }

    public async Task<object> AnalyzeConsultationAsync(ConsultationInput input)
    {
        var text = input.Transcript ?? input.DoctorNotes ?? "";
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Consultation transcript or notes cannot be empty.");
        }

        var geminiApiKey = _configuration["Gemini:ApiKey"] ?? "";
        var geminiModel = _configuration["Gemini:Model"] ?? "gemini-3.5-flash-lite";

        using var db = _connectionFactory.CreateConnection();
        await db.OpenAsync();

        var sw = Stopwatch.StartNew();

        // Patient context (allergies, age, chronic) so the model and safety checks know who is being treated
        Patient? patient = null;
        if (input.PatientId.HasValue)
        {
            patient = await db.QuerySingleOrDefaultAsync<Patient>("SELECT * FROM patients WHERE id = @id;", new { id = input.PatientId });
        }
        var patientContext = patient == null ? "" : $@"

PATIENT CONTEXT (for your awareness only):
- Age/Sex: {patient.age}Y / {patient.gender}
- Known allergies: {patient.allergies}
- Chronic conditions: {patient.chronic_conditions}
Extract EXACTLY what the doctor prescribes, even if it conflicts with the context above: the doctor decides; a separate safety engine will flag conflicts. Never silently drop or substitute a medicine.";

        // --- STAGE 1: Fast PostgreSQL pg_trgm Candidate Retrieval (<3ms across 15,000+ medicines) ---
        var tokens = Regex.Matches(text + " " + (input.CurrentPrescriptionJson ?? ""), @"[\p{L}\p{N}]+")
            .Select(m => m.Value)
            .Where(w => w.Length >= 3 && !IsCommonStopWord(w))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(25)
            .ToList();

        // Bangla/Banglish spellings -> brand/generic names, from the medicine_aliases table (extendable without code changes)
        var aliasTerms = await db.QueryAsync<string>(
            "SELECT DISTINCT target FROM medicine_aliases WHERE @text ILIKE '%' || alias || '%';", new { text });
        foreach (var target in aliasTerms)
        {
            if (!tokens.Contains(target, StringComparer.OrdinalIgnoreCase)) tokens.Add(target);
        }

        var candidateMedicines = new List<Medicine>();
        var seenIds = new HashSet<int>();

        if (tokens.Count > 0)
        {
            var trgmQuery = @"
                SELECT *, 
                       GREATEST(similarity(brand_name, @term), similarity(generic_name, @term)) as score
                FROM medicines
                WHERE brand_name % @term 
                   OR generic_name % @term
                   OR brand_name ILIKE @pattern
                   OR generic_name ILIKE @pattern
                ORDER BY score DESC, brand_name ASC
                LIMIT 5;";

            foreach (var token in tokens.Take(6))
            {
                var matches = await db.QueryAsync<Medicine>(trgmQuery, new 
                { 
                    term = token,
                    pattern = $"%{token}%"
                });

                foreach (var m in matches)
                {
                    if (seenIds.Add(m.id))
                    {
                        candidateMedicines.Add(m);
                    }
                }
            }
        }

        // Always supplement with top essential baseline brands if candidate pool is small
        if (candidateMedicines.Count < 8)
        {
            var baselines = await db.QueryAsync<Medicine>(@"
                SELECT * FROM medicines 
                WHERE generic_name IN ('Paracetamol', 'Omeprazole', 'Esomeprazole', 'Montelukast', 'Azithromycin', 'Metformin', 'Amlodipine')
                   OR brand_name IN ('Napa Extra', 'Seclo 20', 'Sergel 20', 'Monas 10', 'Zimax 500')
                ORDER BY brand_name ASC 
                LIMIT 15;");

            foreach (var b in baselines)
            {
                if (seenIds.Add(b.id))
                {
                    candidateMedicines.Add(b);
                }
            }
        }

        try
        {
            // STAGE 2: Precision Candidate Grounding Context (~400 tokens instead of 550k tokens)
            var medicineContext = string.Join("\n", candidateMedicines.Select(m => 
                $"- {m.brand_name} ({m.generic_name}, {m.form}, {m.strength}, {m.manufacturer})"));

            var hasActivePrescription = !string.IsNullOrWhiteSpace(input.CurrentPrescriptionJson) && input.CurrentPrescriptionJson.Trim() != "[]";
            var activeRxSection = hasActivePrescription
                ? $@"

ACTIVE PRESCRIPTION ON PAD (DOCTOR'S CURRENT DRAFT):
{input.CurrentPrescriptionJson}

AUTONOMOUS INTENT GUIDANCE:
- Evaluate the doctor's input:
  1. AMENDMENT INTENT: If the doctor's words are an instruction to adjust, add, modify, replace, change dosage/duration, or remove medicines from the ACTIVE PRESCRIPTION above (e.g. 'Change Napa to every 4 hours', 'Add Monas 10', 'Dose baran', 'Remove Napa', '৫ দিনের জায়গায় ৭ দিন দিন'), you MUST perform an intelligent AMENDMENT. Update the specified items, add new items, or delete removed items, while preserving all other unaffected items, complaints, diagnosis, and advice.
  2. NEW PRESCRIPTION INTENT: If the doctor dictates a comprehensive new patient dialogue with presenting complaints, vitals, or describes a fresh case, replace the pad and synthesize a fresh new prescription."
                : (input.IsAmendment ? "\nCRITICAL: This is an AMENDMENT. Apply doctor's modifications to any existing active items." : "");

            var systemPrompt = $@"
You are the BanglaRx Clinical AI Engine, a medical AI deployed for hospital chambers in Bangladesh.
You autonomously process clinical dialogue spoken in Bengali (বাংলা), English, or mixed colloquial Banglish with zero-shot code-switching.

Your core clinical tasks:
1. Extract patient Chief Complaints into concise medical symptoms.
2. Extract Vitals (BP, Temp, Pulse, SpO2) ONLY if explicitly stated. Never estimate or infer vitals; omit any that are not stated.
3. Record the diagnosis the doctor stated. If none was stated, return an empty string.
STRICT RULE: Never invent medicines, doses, tests, advice, follow-up or red flags that the doctor did not say. If a section was not mentioned, return an empty list or empty string for it.
4. Extract all prescribed medications. Ground each medicine to genuine Bangladeshi pharmaceutical brands from the inventory below whenever possible.
   - CRITICAL: Include EVERY medicine the doctor names, even if it is NOT in the inventory below. Never drop a medicine. If it is not in the inventory, use the name exactly as spoken for brandName (and the generic name if the doctor said it, otherwise empty). The system will flag it for the doctor to verify.
   - For dosage pattern, capture precise instructions: e.g. '1+0+1', '1+1+1', '1+0+0', '0+0+1', or interval-based patterns like '৪ ঘণ্টা পর পর' (every 4 hrs), '৬ ঘণ্টা পর পর' (every 6 hrs), '৮ ঘণ্টা পর পর' (every 8 hrs), 'জর আসলে ১টি' (as needed / PRN / SOS).
5. Extract Laboratory Investigations Advised by doctor (e.g. 'CBC with ESR', 'Dengue NS1 Antigen', 'Serum Creatinine', 'USG of Whole Abdomen').
6. Extract Patient's Prior Test Reports presented today (e.g. 'Dengue NS1: Positive', 'Platelet: 95,000/μL', 'HbA1c: 8.5%').
7. Extract Patient Dietary & Lifestyle Advice in fluent Bengali (e.g. 'পর্যাপ্ত পানি ও ডাবের পানি খাবেন').
8. Extract Follow-up timing (e.g. '৭ দিন পর রিপোর্টসহ দেখা করবেন') and Red Flag emergency warnings.

{patientContext}
{activeRxSection}

Official Bangladesh Medicines Catalog:
{medicineContext}

You MUST return a valid JSON object strictly matching this schema:
{{
  ""chiefComplaints"": [""string""],
  ""vitals"": {{""bp"": ""string"", ""temp"": ""string"", ""pulse"": ""string""}},
  ""diagnosis"": ""string"",
  ""medicines"": [
    {{
      ""brandName"": ""string"",
      ""genericName"": ""string"",
      ""form"": ""Tablet/Capsule/Syrup/Inhaler"",
      ""strength"": ""string"",
      ""dosagePattern"": ""1+0+1 or ৪ ঘণ্টা পর পর or জর আসলে ১টি"",
      ""duration"": ""string"",
      ""instructionsBangla"": ""string""
    }}
  ],
  ""investigations"": [""string""],
  ""patientReportsPresented"": [""string""],
  ""adviceBangla"": [""string""],
  ""followUp"": ""৭ দিন পর রিপোর্টসহ দেখা করবেন"",
  ""emergencyRedFlags"": ""জ্বর ১০৩ ডিগ্রির বেশি হলে দ্রুত হাসপাতালে যাবেন""
}}";

            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = $"{systemPrompt}\n\nClinical Consultation Dialogue or Doctor Amendment Instructions:\n{text}\n\nOutput Valid JSON:" }
                        }
                    }
                },
                generationConfig = new
                {
                    response_mime_type = "application/json",
                    temperature = 0.2
                }
            };

            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(25);
            client.DefaultRequestHeaders.UserAgent.ParseAdd("BanglaRx-AI-Engine/2.0");
            // the key goes in a header, never in the URL (URLs end up in logs and error messages)
            client.DefaultRequestHeaders.Add("x-goog-api-key", geminiApiKey);

            var endpoint = $"https://generativelanguage.googleapis.com/v1beta/models/{geminiModel}:generateContent";
            var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            var response = await client.PostAsync(endpoint, content);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync();
                throw new Exception($"Gemini API HTTP {response.StatusCode}: {errBody}");
            }

            var jsonStr = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(jsonStr);
            var rawAiText = doc.RootElement
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            // Deserialize LLM Output
            var aiResult = JsonSerializer.Deserialize<ClinicalAiResponse>(rawAiText!, new JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true 
            }) ?? new ClinicalAiResponse();

            // 2. Ground Truth Enrichment: Two-Stage Trigram Match with PostgreSQL Database
            var enrichedMedicines = new List<PrescriptionItem>();
            var detectedGenerics = new List<string>();

            if (aiResult.Medicines != null)
            {
                foreach (var item in aiResult.Medicines)
                {
                    // Strength-aware resolution; ambiguous/unknown stays flagged for the doctor instead of being guessed
                    var resolved = await MedicineResolver.ResolveAsync(db, item, candidateMedicines);
                    enrichedMedicines.Add(resolved);
                    detectedGenerics.Add(resolved.GenericName);
                }
            }

            // 3. Clinical Safety Intercept: Check Drug-Drug Interactions
            var warnings = await _drugSafetyService.CheckInteractionsAsync(detectedGenerics);
            var safetyAlerts = await _safetyService.CheckAsync(new SafetyCheckRequest
            {
                PatientId = input.PatientId,
                Allergies = patient?.allergies,
                Age = patient?.age,
                WeightKg = input.WeightKg,
                Items = enrichedMedicines
            });

            sw.Stop();

            // 4. Audit Log Entry in PostgreSQL
            await db.ExecuteAsync(@"
                INSERT INTO audit_logs (event_type, status, execution_time_ms, details)
                VALUES ('GEMINI_NEURAL_INFERENCE', 'SUCCESS', @elapsed, @details::jsonb);",
                new
                {
                    elapsed = (int)sw.ElapsedMilliseconds,
                    details = JsonSerializer.Serialize(new 
                    { 
                        model = geminiModel, 
                        latency_ms = sw.ElapsedMilliseconds,
                        med_count = enrichedMedicines.Count,
                        ddi_count = warnings.Count
                    })
                });

            return new
            {
                // Only what the doctor actually said: missing sections stay empty, never invented.
                ChiefComplaints = aiResult.ChiefComplaints ?? new List<string>(),
                Vitals = aiResult.Vitals ?? new Dictionary<string, string>(),
                Diagnosis = aiResult.Diagnosis ?? "",
                Medicines = enrichedMedicines,
                Investigations = aiResult.Investigations ?? new List<string>(),
                PatientReportsPresented = aiResult.PatientReportsPresented ?? new List<string>(),
                AdviceBangla = aiResult.AdviceBangla ?? new List<string>(),
                FollowUp = aiResult.FollowUp ?? "",
                EmergencyRedFlags = aiResult.EmergencyRedFlags ?? "",
                InteractionWarnings = warnings,
                SafetyAlerts = safetyAlerts,
                UnmatchedMedicineCount = enrichedMedicines.Count(m => m.MatchStatus != MedicineResolver.Exact),
                ExecutionTimeMs = sw.ElapsedMilliseconds,
                Model = "BanglaRx Multimodal Neural Intelligence (CDSS)"
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            await db.ExecuteAsync(@"
                INSERT INTO audit_logs (event_type, status, execution_time_ms, details)
                VALUES ('GEMINI_NEURAL_INFERENCE', 'ERROR', @elapsed, @details::jsonb);",
                new
                {
                    elapsed = (int)sw.ElapsedMilliseconds,
                    details = JsonSerializer.Serialize(new { error = ex.Message })
                });

            throw;
        }
    }

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "for", "with", "have", "has", "had", "this", "that", "from",
        "patient", "doctor", "complains", "history", "years", "year", "male", "female",
        "days", "times", "daily", "after", "before", "meals", "meal", "food", "hours",
        "take", "takes", "taking", "give", "given", "prescribe", "prescribed", "advised",
        "change", "dosage", "instead", "morning", "night", "bedtime", "continue",
        "এবং", "সাথে", "ধরে", "হলে", "খাবেন", "করবেন", "দিনে", "বার", "খাবার", "আগে", "পরে"
    };

    private static bool IsCommonStopWord(string word) => StopWords.Contains(word);
}
