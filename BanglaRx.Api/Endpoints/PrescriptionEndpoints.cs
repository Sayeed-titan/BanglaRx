using System.Data;
using System.Text.Json;
using BanglaRx.Api.Data;
using BanglaRx.Api.Models.Domain;
using BanglaRx.Api.Models.DTOs;
using Dapper;

namespace BanglaRx.Api.Endpoints;

public static class PrescriptionEndpoints
{
    public static void MapPrescriptionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/prescriptions").WithTags("Prescriptions");

        group.MapGet("/", async (int? doctorId, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var query = @"
                SELECT
                    p.*,
                    d.name as doctor_name, d.specialization as doctor_specialization,
                    pt.full_name as patient_name, pt.age as patient_age, pt.gender as patient_gender
                FROM prescriptions p
                JOIN doctors d ON p.doctor_id = d.id
                JOIN patients pt ON p.patient_id = pt.id
                WHERE (@doctorId IS NULL OR p.doctor_id = @doctorId)
                ORDER BY p.id DESC;";

            var prescriptions = await db.QueryAsync<dynamic>(query, new { doctorId });
            return Results.Ok(prescriptions);
        });

        // Most recent prescription for a patient (used by "Repeat last Rx" for follow-up visits)
        group.MapGet("/latest", async (int patientId, int? doctorId, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var rx = await db.QueryFirstOrDefaultAsync<dynamic>(@"
                SELECT p.*, d.name AS doctor_name
                FROM prescriptions p JOIN doctors d ON p.doctor_id = d.id
                WHERE p.patient_id = @patientId AND (@doctorId IS NULL OR p.doctor_id = @doctorId)
                ORDER BY p.created_at DESC, p.id DESC LIMIT 1;", new { patientId, doctorId });
            if (rx == null) return Results.NotFound(new { Message = "No previous prescription for this patient" });

            int rxId = (int)rx.id;
            var items = await db.QueryAsync<PrescriptionItem>(
                "SELECT * FROM prescription_items WHERE prescription_id = @rxId ORDER BY id ASC;", new { rxId });
            return Results.Ok(new { Prescription = rx, Items = items });
        });

        group.MapGet("/{id:int}", async (int id, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            var rx = await db.QuerySingleOrDefaultAsync<dynamic>(@"
                SELECT
                    p.*,
                    d.name as doctor_name, d.degrees as doctor_degrees, d.specialization as doctor_specialization,
                    d.hospital_name, d.bmdc_reg_no, d.room_no,
                    pt.full_name as patient_name, pt.age as patient_age, pt.gender as patient_gender,
                    pt.blood_group as patient_blood_group, pt.phone as patient_phone, pt.allergies as patient_allergies
                FROM prescriptions p
                JOIN doctors d ON p.doctor_id = d.id
                JOIN patients pt ON p.patient_id = pt.id
                WHERE p.id = @id;", new { id });

            if (rx == null) return Results.NotFound(new { Message = "Prescription not found" });

            var items = await db.QueryAsync<PrescriptionItem>(
                "SELECT * FROM prescription_items WHERE prescription_id = @id ORDER BY id ASC;", new { id });

            return Results.Ok(new
            {
                Prescription = rx,
                Items = items
            });
        });

        group.MapPost("/", async (SavePrescriptionRequest req, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            await db.OpenAsync();
            using var tx = await db.BeginTransactionAsync();

            try
            {
                var seq = await db.ExecuteScalarAsync<long>("SELECT nextval('rx_number_seq');", transaction: tx);
                var rxNumber = $"RX-{DateTime.UtcNow:yyyyMMdd}-{seq:D5}";

                var rxId = await db.QuerySingleAsync<int>(@"
                    INSERT INTO prescriptions (
                        rx_number, doctor_id, patient_id,
                        chief_complaints, clinical_history, vitals,
                        diagnosis, investigations, advice_bangla,
                        interaction_warnings, is_signed,
                        follow_up, referred_to, general_signs, exam_notes, red_flags, patient_reports
                    )
                    VALUES (
                        @rxNumber, @DoctorId, @PatientId,
                        @ChiefComplaints, @ClinicalHistory, @vitalsJson::jsonb,
                        @Diagnosis, @Investigations, @AdviceBangla,
                        @warningsJson::jsonb, true,
                        @FollowUp, @ReferredTo, @signsJson::jsonb, @ExamNotes, @RedFlags, @PatientReports
                    )
                    RETURNING id;", BuildParams(req, rxNumber), tx);

                await InsertItemsAsync(db, tx, rxId, req.Items);
                await tx.CommitAsync();

                return Results.Ok(new
                {
                    Success = true,
                    PrescriptionId = rxId,
                    RxNumber = rxNumber,
                    Version = 1,
                    Message = "Prescription successfully saved and signed!"
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return Results.Problem(detail: ex.Message, title: "Failed to save prescription");
            }
        });

        // Edit after save: replaces content, bumps version, keeps the previous version in audit_logs
        group.MapPut("/{id:int}", async (int id, SavePrescriptionRequest req, IDbConnectionFactory connectionFactory) =>
        {
            using var db = connectionFactory.CreateConnection();
            await db.OpenAsync();
            using var tx = await db.BeginTransactionAsync();

            try
            {
                var existing = await db.QuerySingleOrDefaultAsync<dynamic>(
                    "SELECT rx_number, version, to_jsonb(prescriptions) AS snapshot FROM prescriptions WHERE id = @id FOR UPDATE;",
                    new { id }, tx);
                if (existing == null)
                {
                    await tx.RollbackAsync();
                    return Results.NotFound(new { Message = "Prescription not found" });
                }

                var oldItems = await db.QueryAsync<PrescriptionItem>(
                    "SELECT * FROM prescription_items WHERE prescription_id = @id ORDER BY id;", new { id }, tx);
                await db.ExecuteAsync(@"
                    INSERT INTO audit_logs (event_type, status, execution_time_ms, details)
                    VALUES ('PRESCRIPTION_REVISED', 'SUCCESS', 0, @details::jsonb);",
                    new
                    {
                        details = JsonSerializer.Serialize(new
                        {
                            prescription_id = id,
                            previous_version = (int)existing.version,
                            previous = JsonSerializer.Deserialize<JsonElement>((string)existing.snapshot.ToString()),
                            previous_items = oldItems
                        })
                    }, tx);

                var p = BuildParams(req, (string)existing.rx_number);
                var dp = new DynamicParameters(p);
                dp.Add("id", id);
                await db.ExecuteAsync(@"
                    UPDATE prescriptions SET
                        chief_complaints = @ChiefComplaints, clinical_history = @ClinicalHistory,
                        vitals = @vitalsJson::jsonb, diagnosis = @Diagnosis, investigations = @Investigations,
                        advice_bangla = @AdviceBangla, interaction_warnings = @warningsJson::jsonb,
                        follow_up = @FollowUp, referred_to = @ReferredTo, general_signs = @signsJson::jsonb,
                        exam_notes = @ExamNotes, red_flags = @RedFlags, patient_reports = @PatientReports,
                        version = version + 1, updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id;", dp, tx);

                await db.ExecuteAsync("DELETE FROM prescription_items WHERE prescription_id = @id;", new { id }, tx);
                await InsertItemsAsync(db, tx, id, req.Items);
                await tx.CommitAsync();

                return Results.Ok(new
                {
                    Success = true,
                    PrescriptionId = id,
                    RxNumber = (string)existing.rx_number,
                    Version = (int)existing.version + 1,
                    Message = "Prescription updated."
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return Results.Problem(detail: ex.Message, title: "Failed to update prescription");
            }
        });
    }

    private static object BuildParams(SavePrescriptionRequest req, string rxNumber) => new
    {
        rxNumber,
        req.DoctorId,
        req.PatientId,
        ChiefComplaints = req.ChiefComplaints.ToArray(),
        req.ClinicalHistory,
        vitalsJson = JsonSerializer.Serialize(req.Vitals ?? new Dictionary<string, string>()),
        req.Diagnosis,
        Investigations = (req.Investigations ?? new List<string>()).ToArray(),
        AdviceBangla = req.AdviceBangla.ToArray(),
        warningsJson = JsonSerializer.Serialize(req.InteractionWarnings ?? new List<string>()),
        req.FollowUp,
        req.ReferredTo,
        signsJson = JsonSerializer.Serialize(req.GeneralSigns ?? new Dictionary<string, string>()),
        req.ExamNotes,
        req.RedFlags,
        PatientReports = (req.PatientReports ?? new List<string>()).ToArray()
    };

    private static async Task InsertItemsAsync(IDbConnection db, IDbTransaction tx, int rxId, List<PrescriptionItem>? items)
    {
        if (items == null) return;
        const string sql = @"
            INSERT INTO prescription_items (
                prescription_id, medicine_id, brand_name, generic_name,
                form, strength, dosage_pattern, duration, instructions_bangla
            )
            VALUES (
                @prescriptionId, @MedicineId, @BrandName, @GenericName,
                @Form, @Strength, @DosagePattern, @Duration, @InstructionsBangla
            );";

        foreach (var item in items)
        {
            await db.ExecuteAsync(sql, new
            {
                prescriptionId = rxId,
                item.MedicineId,
                item.BrandName,
                item.GenericName,
                item.Form,
                item.Strength,
                item.DosagePattern,
                item.Duration,
                item.InstructionsBangla
            }, tx);
        }
    }
}
