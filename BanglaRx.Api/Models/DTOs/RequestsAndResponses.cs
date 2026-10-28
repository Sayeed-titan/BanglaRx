using BanglaRx.Api.Models.Domain;

namespace BanglaRx.Api.Models.DTOs;

public class CreatePatientRequest
{
    public string FullName { get; set; } = "";
    public int Age { get; set; }
    public string Gender { get; set; } = "Male";
    public string Phone { get; set; } = "";
    public string BloodGroup { get; set; } = "B+";
    public string? Allergies { get; set; }
    public string? ChronicConditions { get; set; }
}

public class AddToQueueRequest
{
    public int DoctorId { get; set; } = 1;
    public int PatientId { get; set; } = 1;
    public Dictionary<string, string>? TriageVitals { get; set; }
    public string? ChiefComplaint { get; set; }
}

public class UpdateQueueStatusRequest
{
    public string Status { get; set; } = "Waiting";
}

public class SavePrescriptionRequest
{
    public int DoctorId { get; set; } = 1;
    public int PatientId { get; set; } = 1;
    public List<string> ChiefComplaints { get; set; } = new();
    public string ClinicalHistory { get; set; } = "";
    public Dictionary<string, string>? Vitals { get; set; }
    public string Diagnosis { get; set; } = "";
    public List<string>? Investigations { get; set; }
    public List<string> AdviceBangla { get; set; } = new();
    public List<string>? InteractionWarnings { get; set; }
    public List<PrescriptionItem>? Items { get; set; }
}

public class CheckInteractionsRequest
{
    public List<string>? GenericNames { get; set; }
}

public class ConsultationInput
{
    public string? Transcript { get; set; }
    public string? DoctorNotes { get; set; }
    public bool IsAmendment { get; set; } = false;
    public string? CurrentPrescriptionJson { get; set; }
}

public class ClinicalAiResponse
{
    public List<string>? ChiefComplaints { get; set; }
    public Dictionary<string, string>? Vitals { get; set; }
    public string? Diagnosis { get; set; }
    public List<PrescriptionItem>? Medicines { get; set; }
    public List<string>? Investigations { get; set; }
    public List<string>? PatientReportsPresented { get; set; }
    public List<string>? AdviceBangla { get; set; }
    public string? FollowUp { get; set; }
    public string? EmergencyRedFlags { get; set; }
}
