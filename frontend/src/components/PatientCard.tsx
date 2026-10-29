import React from 'react';
import type { Patient, QueueItem } from '../types/index';
import { Badge, Card, Select } from '../design-system';

interface PatientCardProps {
  patient: Patient | null;
  patients: Patient[];
  /** the patient's open queue entry, if they have a token today */
  queueItem?: QueueItem;
  onSelectPatient: (p: Patient) => void;
}

const MISSING = new Set(['', 'Not recorded', 'None Reported', 'Unknown']);

/** "Patient in chamber": who the doctor is seeing now, with token, complaint and allergy. */
export const PatientCard: React.FC<PatientCardProps> = ({ patient, patients, queueItem, onSelectPatient }) => {
  const allergy = patient?.allergies?.trim() ?? '';
  const hasAllergy = !MISSING.has(allergy);

  return (
    <Card aria-label="Patient in chamber" className="rx-patientcard">
      <div className="rx-patientcard__who">
        {queueItem && (
          <div className="rx-patientcard__token" aria-label={`Token ${queueItem.token_number}`}>
            <small>TOKEN</small>
            <strong>{queueItem.token_number}</strong>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div className="rx-patientcard__name">{patient?.full_name ?? 'No patient selected'}</div>
          <div className="rx-patientcard__meta">{patient ? `${patient.age} years · ${patient.gender}` : 'Choose one from the queue'}</div>
        </div>
      </div>

      {patient && (
        <div className="rx-row" style={{ gap: 8 }}>
          {queueItem?.chief_complaint && <Badge tone="outline">{queueItem.chief_complaint}</Badge>}
          <Badge tone={hasAllergy ? 'danger' : 'neutral'}>{hasAllergy ? `Allergy: ${allergy}` : 'Allergies: Not recorded'}</Badge>
          {patient.chronic_conditions && !MISSING.has(patient.chronic_conditions) && <Badge tone="info">{patient.chronic_conditions}</Badge>}
        </div>
      )}

      {patients.length > 1 && (
        <Select
          label="Switch patient"
          value={patient?.id ?? ''}
          onChange={(e) => {
            const p = patients.find((x) => x.id === Number(e.target.value));
            if (p) onSelectPatient(p);
          }}
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} ({p.age}Y, {p.gender})
            </option>
          ))}
        </Select>
      )}
    </Card>
  );
};
