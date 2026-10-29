import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { QueueItem } from '../types/index';
import { Button, Card, PageHeader, SegmentedControl, Select, TextField } from '../design-system';

interface RegistrationPageProps {
  queue: QueueItem[];
  doctorName?: string;
  roomNo?: string;
  onPatientRegistered: (patient: any, queueItem?: any) => void;
  activeDoctorId: number;
}

const FORM_ID = 'patient-registration-form';
const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
] as const;

function Step({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <Card className="rx-step" aria-labelledby={`step-${n}`}>
      <div className="rx-step__head">
        <span className="rx-step__num" aria-hidden="true">{n}</span>
        <h2 id={`step-${n}`}>{title}</h2>
        {optional && <span className="rx-badge rx-badge--attention">Optional</span>}
      </div>
      {children}
    </Card>
  );
}

/** Reception intake as a page: who, why, a quick triage check, then a token. */
export const RegistrationPage: React.FC<RegistrationPageProps> = ({ queue, doctorName, roomNo, onPatientRegistered, activeDoctorId }) => {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [phone, setPhone] = useState('+880 ');
  const [bloodGroup, setBloodGroup] = useState('Unknown');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');

  // Triage vitals. Anything left blank is never sent, so the pad shows "Not recorded".
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [temp, setTemp] = useState('');
  const [pulse, setPulse] = useState('');
  const [spo2, setSpo2] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const waiting = queue.filter((q) => q.status === 'Waiting').length;
  const nextToken = queue.reduce((m, q) => Math.max(m, q.token_number), 0) + 1;

  const handleClearForm = () => {
    setFullName('');
    setAge('');
    setGender('Male');
    setPhone('+880 ');
    setBloodGroup('Unknown');
    setAllergies('');
    setChronicConditions('');
    setChiefComplaint('');
    setBpSys('');
    setBpDia('');
    setTemp('');
    setPulse('');
    setSpo2('');
    setHeight('');
    setWeight('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !age) {
      alert('Please provide patient name and age.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Patient in Database
      const patRes = await fetch('http://localhost:5000/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          age: Number(age),
          gender,
          phone,
          bloodGroup,
          allergies: allergies.trim() || 'Not recorded',
          chronicConditions: chronicConditions.trim() || 'Not recorded'
        })
      });
      const newPatient = await patRes.json();

      // Format vitals with standard clinical units
      const triageVitals: Record<string, string> = {};
      if (bpSys && bpDia) triageVitals.bp = `${bpSys}/${bpDia} mmHg`;
      else if (bpSys) triageVitals.bp = `${bpSys} mmHg`;
      if (temp) triageVitals.temp = `${temp} °F`;
      if (pulse) triageVitals.pulse = `${pulse} bpm`;
      if (spo2) triageVitals.spo2 = `${spo2}%`;
      if (height) triageVitals.height = `${height} cm`;
      if (weight) triageVitals.weight = `${weight} kg`;

      // 2. Add to Today's Chamber Queue
      const queueRes = await fetch('http://localhost:5000/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: activeDoctorId,
          patientId: newPatient.id,
          triageVitals,
          chiefComplaint: chiefComplaint.trim() || 'General Consultation'
        })
      });
      const queueData = await queueRes.json();

      onPatientRegistered(newPatient, { ...queueData, triage_vitals: triageVitals, chief_complaint: chiefComplaint.trim() });
      handleClearForm();
      window.location.hash = '#/queue';
    } catch (err) {
      console.error('Failed to register patient:', err);
      alert('Registration failed. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rx-page">
      <PageHeader
        title="New patient and chamber token"
        subtitle="Reception intake, a quick triage check, then a serial number"
        backHref="#/queue"
        backLabel="Back to the queue"
      />

      <form id={FORM_ID} className="rx-split" onSubmit={handleSubmit}>
        <div className="rx-split__main">
          <Step n={1} title="Who is the patient?">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <TextField label="Full name" required placeholder="e.g. Shahnaz Begum" value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ gridColumn: 'span 2' }} />
              <TextField label="Age" suffix="years" required type="number" placeholder="38" value={age} onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
              <div className="rx-field">
                <span className="rx-field__label">Gender</span>
                <SegmentedControl label="Gender" value={gender} onChange={setGender} options={GENDERS} />
              </div>
              <Select label="Blood group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                <option value="Unknown">Unknown / not recorded</option>
                <option value="A+">A+ positive</option>
                <option value="A-">A− negative</option>
                <option value="B+">B+ positive</option>
                <option value="B-">B− negative</option>
                <option value="O+">O+ positive</option>
                <option value="O-">O− negative</option>
                <option value="AB+">AB+ positive</option>
                <option value="AB-">AB− negative</option>
              </Select>
            </div>
            <TextField label="Mobile number" required type="tel" placeholder="+880 1712-000000" value={phone} onChange={(e) => setPhone(e.target.value)} helper="The patient's app and SMS updates use this number." style={{ maxWidth: 360 }} />
          </Step>

          <Step n={2} title="Why have they come?">
            <TextField label="Today's main problem" placeholder="e.g. Fever 102°F and nausea for 2 days" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              <TextField label="Known drug allergies" placeholder="e.g. Penicillin. Leave blank if unknown" value={allergies} onChange={(e) => setAllergies(e.target.value)} />
              <TextField label="Long-term conditions" placeholder="e.g. Diabetes, high blood pressure" value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} />
            </div>
          </Step>

          <Step n={3} title="Quick triage check" optional>
            <p style={{ margin: 0, fontSize: 'var(--rx-fs-label)', lineHeight: 1.55, color: 'var(--rx-ink-2)' }}>
              Only enter what you actually measured. Anything left blank shows as <strong>Not recorded</strong> on the prescription, never guessed.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
              <div className="rx-field">
                <span className="rx-field__label" id="bp-label">Blood pressure</span>
                <div role="group" aria-labelledby="bp-label" className="rx-row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                  <input className="rx-select" type="number" aria-label="Systolic" placeholder="120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} style={{ textAlign: 'center', padding: '0 6px' }} />
                  <span aria-hidden="true">/</span>
                  <input className="rx-select" type="number" aria-label="Diastolic" placeholder="80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} style={{ textAlign: 'center', padding: '0 6px' }} />
                </div>
                <span className="rx-field__help">mmHg</span>
              </div>
              <TextField label="Temperature" suffix="°F" type="number" step="0.1" placeholder="98.6" value={temp} onChange={(e) => setTemp(e.target.value)} />
              <TextField label="Pulse" suffix="bpm" type="number" placeholder="76" value={pulse} onChange={(e) => setPulse(e.target.value)} />
              <TextField label="Oxygen (SpO₂)" suffix="%" type="number" placeholder="98" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              <TextField label="Height" suffix="cm" type="number" placeholder="160" value={height} onChange={(e) => setHeight(e.target.value)} />
              <TextField label="Weight" suffix="kg" type="number" step="0.5" placeholder="60" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
          </Step>
        </div>

        <aside className="rx-split__side rx-split__side--sticky" aria-label="Token preview">
          <section className="rx-tokencard">
            <span className="rx-tokencard__label">NEXT TOKEN</span>
            <div className="rx-row" style={{ alignItems: 'baseline', gap: 10 }}>
              <span className="rx-tokencard__num">{nextToken}</span>
              <span>after {waiting} waiting</span>
            </div>
            <hr />
            <div style={{ lineHeight: 1.5 }}>
              <div style={{ opacity: 0.85 }}>{doctorName ?? 'No doctor selected'}</div>
              {roomNo && <div>{roomNo}</div>}
            </div>
          </section>
          <div className="rx-stack" style={{ gap: 10 }}>
            <Button type="submit" size="lg" fullWidth icon={<Check size={20} />} disabled={isSubmitting}>
              {isSubmitting ? 'Registering…' : 'Register and issue token'}
            </Button>
            <Button variant="outlined" fullWidth onClick={handleClearForm}>
              Clear the form
            </Button>
          </div>
          <p style={{ margin: 0, fontSize: 'var(--rx-fs-caption)', lineHeight: 1.55, color: 'var(--rx-ink-2)' }}>
            The token number is confirmed by the server when you register.
          </p>
        </aside>
      </form>
    </div>
  );
};
