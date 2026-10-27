import React, { useState } from 'react';
import { X, UserPlus, HeartPulse, ShieldAlert, Check } from 'lucide-react';

interface PatientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientRegistered: (patient: any, queueItem?: any) => void;
  activeDoctorId: number;
}

export const PatientRegistrationModal: React.FC<PatientRegistrationModalProps> = ({
  isOpen,
  onClose,
  onPatientRegistered,
  activeDoctorId,
}) => {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('Male');
  const [phone, setPhone] = useState('+880 ');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  
  // Triage Vitals
  const [bp, setBp] = useState('120/80 mmHg');
  const [temp, setTemp] = useState('98.6 F');
  const [pulse, setPulse] = useState('78 bpm');
  const [weight, setWeight] = useState('65 kg');

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

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
          allergies: allergies.trim() || 'None Reported',
          chronicConditions: chronicConditions.trim() || 'None'
        })
      });
      const newPatient = await patRes.json();

      // 2. Add to Today's Chamber Queue
      const queueRes = await fetch('http://localhost:5000/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: activeDoctorId,
          patientId: newPatient.id,
          triageVitals: { bp, temp, pulse, weight },
          chiefComplaint: chiefComplaint.trim() || 'General Consultation'
        })
      });
      const queueData = await queueRes.json();

      onPatientRegistered(newPatient, queueData);
      onClose();
    } catch (err) {
      console.error('Failed to register patient:', err);
      alert('Registration failed. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="anim-scale-in"
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: '580px',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid var(--slate-200)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--slate-50)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--teal-50)',
              color: 'var(--teal-700)',
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              display: 'flex'
            }}>
              <UserPlus size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: '800', color: 'var(--slate-900)' }}>
                Patient Entry & Chamber Token
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                Reception intake, triage pre-check & queue issuance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-clinical btn-outline"
            style={{ padding: '6px', borderRadius: 'var(--radius-sm)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '22px', maxHeight: '75vh', overflowY: 'auto' }}>
          
          {/* Section 1: Demographics */}
          <div style={{ marginBottom: '18px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Patient Demographics:
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginTop: '8px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shahnaz Begum"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Age (Years) *</label>
                <input
                  type="number"
                  required
                  placeholder="38"
                  value={age}
                  onChange={e => setAge(e.target.value ? Number(e.target.value) : '')}
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Gender</label>
                <select
                  value={gender}
                  onChange={e => setGender(e.target.value)}
                  className="select-clinical"
                  style={{ marginTop: '4px' }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Contact Phone *</label>
                <input
                  type="text"
                  required
                  placeholder="+880 1712-XXXXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={e => setBloodGroup(e.target.value)}
                  className="select-clinical"
                  style={{ marginTop: '4px' }}
                >
                  <option value="A+">A+ Positive</option>
                  <option value="A-">A- Negative</option>
                  <option value="B+">B+ Positive</option>
                  <option value="B-">B- Negative</option>
                  <option value="O+">O+ Positive</option>
                  <option value="O-">O- Negative</option>
                  <option value="AB+">AB+ Positive</option>
                  <option value="AB-">AB- Negative</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Baseline & History */}
          <div style={{ marginBottom: '18px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Medical History & Reason for Visit:
            </span>

            <div style={{ marginTop: '8px' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Today's Chief Complaint</label>
              <input
                type="text"
                placeholder="e.g. Severe headache, high fever 102F and nausea for 2 days"
                value={chiefComplaint}
                onChange={e => setChiefComplaint(e.target.value)}
                className="input-clinical"
                style={{ marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Known Drug Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa, None"
                  value={allergies}
                  onChange={e => setAllergies(e.target.value)}
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--slate-700)' }}>Chronic Conditions</label>
                <input
                  type="text"
                  placeholder="e.g. Type 2 Diabetes, HTN, None"
                  value={chronicConditions}
                  onChange={e => setChronicConditions(e.target.value)}
                  className="input-clinical"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Triage Vitals (Assistant Pre-Check) */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <HeartPulse size={14} color="var(--teal-600)" />
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Triage Vitals (Pre-Consultation Measurements):
              </span>
            </div>

            <div style={{
              background: 'var(--slate-50)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px'
            }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: '600' }}>BP</label>
                <input
                  type="text"
                  value={bp}
                  onChange={e => setBp(e.target.value)}
                  className="input-clinical"
                  style={{ padding: '6px 8px', fontSize: '0.78rem', marginTop: '2px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: '600' }}>Temp</label>
                <input
                  type="text"
                  value={temp}
                  onChange={e => setTemp(e.target.value)}
                  className="input-clinical"
                  style={{ padding: '6px 8px', fontSize: '0.78rem', marginTop: '2px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: '600' }}>Pulse</label>
                <input
                  type="text"
                  value={pulse}
                  onChange={e => setPulse(e.target.value)}
                  className="input-clinical"
                  style={{ padding: '6px 8px', fontSize: '0.78rem', marginTop: '2px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: '600' }}>Weight</label>
                <input
                  type="text"
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  className="input-clinical"
                  style={{ padding: '6px 8px', fontSize: '0.78rem', marginTop: '2px' }}
                />
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-clinical btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-clinical btn-primary-teal"
            >
              <Check size={16} />
              {isSubmitting ? 'Registering & Queuing...' : 'Register & Issue Serial Token'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
