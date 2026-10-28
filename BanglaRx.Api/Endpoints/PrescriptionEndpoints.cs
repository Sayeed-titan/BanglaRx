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
                var rxNumber = $"RX-{DateTime.UtcNow:yyyyMMdd}-{Random.Shared.Next(1000, 9999)}";
                var vitalsJson = JsonSerializer.Serialize(req.Vitals ?? new Dictionary<string, string>());
                var warningsJson = JsonSerializer.Serialize(req.InteractionWarnings ?? new List<string>());

                var insertRxSql = @"
                    INSERT INTO prescriptions (
                        rx_number, doctor_id, patient_id, 
                        chief_complaints, clinical_history, vitals, 
                        diagnosis, investigations, advice_bangla, 
                        interaction_warnings, is_signed
                    )
                    VALUES (
                        @rxNumber, @DoctorId, @PatientId, 
                        @ChiefComplaints, @ClinicalHistory, @vitalsJson::jsonb, 
                        @Diagnosis, @Investigations, @AdviceBangla, 
                        @warningsJson::jsonb, true
                    )
                    RETURNING id;";

                var rxId = await db.QuerySingleAsync<int>(insertRxSql, new
                {
                    rxNumber,
                    req.DoctorId,
                    req.PatientId,
                    req.ChiefComplaints,
                    req.ClinicalHistory,
                    vitalsJson,
                    req.Diagnosis,
                    req.Investigations,
                    req.AdviceBangla,
                    warningsJson
                }, tx);

                if (req.Items != null && req.Items.Count > 0)
                {
                    var insertItemSql = @"
                        INSERT INTO prescription_items (
                            prescription_id, medicine_id, brand_name, generic_name, 
                            form, strength, dosage_pattern, duration, instructions_bangla
                        )
                        VALUES (
                            @prescriptionId, @MedicineId, @BrandName, @GenericName, 
                            @Form, @Strength, @DosagePattern, @Duration, @InstructionsBangla
                        );";

                    foreach (var item in req.Items)
                    {
                        await db.ExecuteAsync(insertItemSql, new
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

                await tx.CommitAsync();

                return Results.Ok(new
                {
                    Success = true,
                    PrescriptionId = rxId,
                    RxNumber = rxNumber,
                    Message = "Prescription successfully saved and signed!"
                });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                return Results.Problem(detail: ex.Message, title: "Failed to save prescription");
            }
        });
    }
}
