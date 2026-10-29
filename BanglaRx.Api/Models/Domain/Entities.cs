namespace BanglaRx.Api.Models.Domain;

public class Medicine
{
    public int id { get; set; }
    public string brand_name { get; set; } = "";
    public string generic_name { get; set; } = "";
    public string form { get; set; } = "";
    public string strength { get; set; } = "";
    public string manufacturer { get; set; } = "";
    public string therapeutic_class { get; set; } = "";
    public string standard_dosage { get; set; } = "";
    public string instructions_bangla { get; set; } = "";
}

public class DrugInteraction
{
    public int id { get; set; }
    public string generic_a { get; set; } = "";
    public string generic_b { get; set; } = "";
    public string severity { get; set; } = "";
    public string description { get; set; } = "";
    public string clinical_advice { get; set; } = "";
}

public class Doctor
{
    public int id { get; set; }
    public string name { get; set; } = "";
    public string degrees { get; set; } = "";
    public string specialization { get; set; } = "";
    public string bmdc_reg_no { get; set; } = "";
    public string hospital_name { get; set; } = "";
    public string room_no { get; set; } = "";
    public string phone { get; set; } = "";
    public string email { get; set; } = "";
}

public class Patient
{
    public int id { get; set; }
    public string patient_uid { get; set; } = "";
    public string full_name { get; set; } = "";
    public int age { get; set; }
    public string gender { get; set; } = "";
    public string phone { get; set; } = "";
    public string blood_group { get; set; } = "";
    public string allergies { get; set; } = "";
    public string chronic_conditions { get; set; } = "";
}

public class PrescriptionItem
{
    public int? MedicineId { get; set; }
    public string BrandName { get; set; } = "";
    public string GenericName { get; set; } = "";
    public string Form { get; set; } = "";
    public string Strength { get; set; } = "";
    public string DosagePattern { get; set; } = "";
    public string Duration { get; set; } = "";
    public string InstructionsBangla { get; set; } = "";

    // Formulary match result (not stored in DB): exact | ambiguous | fuzzy | strength_unavailable | unmatched
    public string? MatchStatus { get; set; }
    public List<MedicineOption>? MatchOptions { get; set; }
}

public class MedicineOption
{
    public int Id { get; set; }
    public string BrandName { get; set; } = "";
    public string GenericName { get; set; } = "";
    public string Form { get; set; } = "";
    public string Strength { get; set; } = "";
}
