// ============================================================================
// TYPES: Core Domain Models for BanglaRx AI
// ============================================================================

export interface Doctor {
  id: number;
  name: string;
  degrees: string;
  specialization: string;
  bmdc_reg_no: string;
  hospital_name: string;
  room_no: string;
  phone?: string;
  email?: string;
}

export interface Patient {
  id: number;
  patient_uid: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  blood_group: string;
  allergies: string;
  chronic_conditions: string;
}

export interface QueueItem {
  id: number;
  token_number: number;
  doctor_id: number;
  patient_id: number;
  status: 'Waiting' | 'In Consultation' | 'Completed';
  triage_vitals: any;
  chief_complaint?: string;
  created_at: string;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  patient_phone: string;
  patient_blood_group: string;
  patient_allergies?: string;
  patient_chronic?: string;
  patient_uid: string;
}

export interface PrescriptionItem {
  medicineId?: number;
  brandName: string;
  genericName: string;
  form: string;
  strength: string;
  dosagePattern: string;
  duration: string;
  instructionsBangla: string;
}

export interface DrugWarning {
  drugA: string;
  drugB: string;
  severity: string;
  description: string;
  clinicalAdvice: string;
}

export interface AccuracyMetrics {
  spokenWordsCount: number;
  acceptedEntitiesCount: number;
  conversionRate: number;
  confidenceScore: number;
  detectedCategories: {
    symptoms: number;
    vitals: number;
    medications: number;
    instructions: number;
  };
}
