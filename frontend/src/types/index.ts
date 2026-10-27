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
