import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Badge, Button, Card } from '../design-system';
import { getJson } from '../api';

interface Rep {
  id: number;
  kind: string;
  takenOn: string | null;
  createdAt: string;
  values: Array<{ name: string; value: string; unit: string }>;
}

/** What the patient photographed and confirmed in their app. Shown as unverified: the doctor decides whether to rely on it. */
export const PatientReportsCard: React.FC<{ patientId?: number; onReviewed: (text: string) => void }> = ({ patientId, onReviewed }) => {
  const [reports, setReports] = useState<Rep[]>([]);

  useEffect(() => {
    setReports([]);
    if (!patientId) return;
    let live = true;
    getJson<Rep[]>(`/patients/${patientId}/reports`).then((r) => live && setReports(r)).catch(() => {});
    return () => {
      live = false;
    };
  }, [patientId]);

  if (reports.length === 0) return null;
  return (
    <Card>
      <div className="rx-stack" style={{ gap: 8 }}>
        <div className="rx-row" style={{ justifyContent: 'space-between' }}>
          <strong className="rx-row" style={{ gap: 6 }}><FileText size={16} aria-hidden="true" /> Reports from the patient</strong>
          <Badge tone="attention">Patient-given, AI-read</Badge>
        </div>
        {reports.slice(0, 3).map((r) => (
          <div key={r.id} className="rx-stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
              {r.kind} · {new Date(r.takenOn ?? r.createdAt).toLocaleDateString('en-GB')}
            </span>
            {r.values.map((v, i) => (
              <div key={i} className="rx-row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <span>{v.name}: <strong>{v.value} {v.unit}</strong></span>
                <Button variant="text" onClick={() => onReviewed(`${v.name} ${v.value}${v.unit ? ` ${v.unit}` : ''}`)}>Add to reviewed</Button>
              </div>
            ))}
          </div>
        ))}
        <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Read from a photo and checked by the patient. Not a lab result: verify before you rely on it.</span>
      </div>
    </Card>
  );
};
