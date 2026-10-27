import React, { useState } from 'react';
import { X, UserPlus, HeartPulse, Check, RotateCcw } from 'lucide-react';

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
  
  // Triage Vitals (Numeric inputs with fixed suffix badges)
  const [bpSys, setBpSys] = useState('120');
  const [bpDia, setBpDia] = useState('80');
  const [temp, setTemp] = useState('98.6');
  const [pulse, setPulse] = useState('78');
  const [weight, setWeight] = useState('65');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClearForm = () => {
    setFullName('');
    setAge('');
    setGender('Male');
    setPhone('+880 ');
    setBloodGroup('B+');
    setAllergies('');
    setChronicConditions('');
    setChiefComplaint('');
    setBpSys('');
    setBpDia('');
    setTemp('');
    setPulse('');
    setWeight('');
  };

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

      // Format vitals with standard clinical units
      const triageVitals: Record<string, string> = {};
      if (bpSys && bpDia) triageVitals.bp = `${bpSys}/${bpDia} mmHg`;
      else if (bpSys) triageVitals.bp = `${bpSys} mmHg`;
      if (temp) triageVitals.temp = `${temp} °F`;
      if (pulse) triageVitals.pulse = `${pulse} bpm`;
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HeartPulse size={14} color="var(--teal-600)" />
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  3. Triage Vitals (Numeric Entry):
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--slate-400)' }}>
                Units attached automatically
              </span>
            </div>

            <div style={{
              background: 'var(--slate-50)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              display: 'grid',
              gridTemplateColumns: '1.3fr 1fr 1fr 1fr',
              gap: '8px'
            }}>
              {/* BP Systolic / Diastolic */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-600)', fontWeight: '700', display: 'block', marginBottom: '3px' }}>
                  BP (Sys / Dia)
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  border: '1px solid var(--slate-300)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}>
                  <input
                    type="number"
                    placeholder="120"
                    value={bpSys}
                    onChange={e => setBpSys(e.target.value)}
                    style={{
                      width: '42px',
                      border: 'none',
                      outline: 'none',
                      padding: '6px 4px',
                      fontSize: '0.78rem',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ color: 'var(--slate-400)', fontWeight: 'bold', fontSize: '0.75rem' }}>/</span>
                  <input
                    type="number"
                    placeholder="80"
                    value={bpDia}
                    onChange={e => setBpDia(e.target.value)}
                    style={{
                      width: '42px',
                      border: 'none',
                      outline: 'none',
                      padding: '6px 4px',
                      fontSize: '0.78rem',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{
                    background: 'var(--slate-100)',
                    color: 'var(--slate-600)',
                    fontSize: '0.66rem',
                    fontWeight: '700',
                    padding: '6px 6px',
                    borderLeft: '1px solid var(--slate-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    mmHg
                  </span>
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-600)', fontWeight: '700', display: 'block', marginBottom: '3px' }}>
                  Temperature
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  border: '1px solid var(--slate-300)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="98.6"
                    value={temp}
                    onChange={e => setTemp(e.target.value)}
                    style={{
                      width: '100%',
                      minWidth: '40px',
                      border: 'none',
                      outline: 'none',
                      padding: '6px 8px',
                      fontSize: '0.78rem'
                    }}
                  />
                  <span style={{
                    background: 'var(--slate-100)',
                    color: 'var(--slate-600)',
                    fontSize: '0.66rem',
                    fontWeight: '700',
                    padding: '6px 6px',
                    borderLeft: '1px solid var(--slate-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    °F
                  </span>
                </div>
              </div>

              {/* Pulse */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-600)', fontWeight: '700', display: 'block', marginBottom: '3px' }}>
                  Pulse Rate
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  border: '1px solid var(--slate-300)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}>
                  <input
                    type="number"
                    placeholder="78"
                    value={pulse}
                    onChange={e => setPulse(e.target.value)}
                    style={{
                      width: '100%',
                      minWidth: '40px',
                      border: 'none',
                      outline: 'none',
                      padding: '6px 8px',
                      fontSize: '0.78rem'
                    }}
                  />
                  <span style={{
                    background: 'var(--slate-100)',
                    color: 'var(--slate-600)',
                    fontSize: '0.66rem',
                    fontWeight: '700',
                    padding: '6px 6px',
                    borderLeft: '1px solid var(--slate-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    bpm
                  </span>
                </div>
              </div>

              {/* Weight */}
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--slate-600)', fontWeight: '700', display: 'block', marginBottom: '3px' }}>
                  Body Weight
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#FFFFFF',
                  border: '1px solid var(--slate-300)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden'
                }}>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="65"
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    style={{
                      width: '100%',
                      minWidth: '40px',
                      border: 'none',
                      outline: 'none',
                      padding: '6px 8px',
                      fontSize: '0.78rem'
                    }}
                  />
                  <span style={{
                    background: 'var(--slate-100)',
                    color: 'var(--slate-600)',
                    fontSize: '0.66rem',
                    fontWeight: '700',
                    padding: '6px 6px',
                    borderLeft: '1px solid var(--slate-200)',
                    whiteSpace: 'nowrap'
                  }}>
                    kg
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Row with Clear Form button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '1px solid var(--slate-200)'
          }}>
            <button
              type="button"
              onClick={handleClearForm}
              className="btn-clinical btn-outline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--slate-600)',
                fontSize: '0.76rem',
                padding: '7px 12px'
              }}
              title="Clear all fields in this form"
            >
              <RotateCcw size={14} />
              <span>Clear Form (রিসেট)</span>
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>

        </form>

      </div>
    </div>
  );
};
