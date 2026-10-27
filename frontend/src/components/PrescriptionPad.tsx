import React from 'react';
import { HeartPulse, ShieldAlert, Trash2, Volume2 } from 'lucide-react';
import type { Doctor, Patient, PrescriptionItem, DrugWarning } from '../types/index';

interface PrescriptionPadProps {
  doctor: Doctor | null;
  patient: Patient | null;
  savedRxNumber: string;
  vitals: { bp: string; temp: string; pulse: string };
  complaints: string[];
  diagnosis: string;
  medicines: PrescriptionItem[];
  investigations: string[];
  advice: string[];
  warnings: DrugWarning[];
  onDeleteMedicine: (index: number) => void;
  onSpeakBangla: (text: string) => void;
}

export const PrescriptionPad: React.FC<PrescriptionPadProps> = ({
  doctor,
  patient,
  savedRxNumber,
  vitals,
  complaints,
  diagnosis,
  medicines,
  investigations,
  advice,
  warnings,
  onDeleteMedicine,
  onSpeakBangla,
}) => {
  return (
    <div className="rx-paper" style={{ 
      background: '#FFFFFF', 
      borderRadius: '12px', 
      boxShadow: 'var(--shadow-md)',
      border: '1px solid #E2E8F0',
      padding: '28px',
      minHeight: '800px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <div>
        {/* DOCTOR HEADER */}
        <div style={{ 
          borderBottom: '2px solid #0F52BA', 
          paddingBottom: '16px', 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0F52BA' }}>
              {doctor?.name || 'Prof. Dr. M. A. Rahman'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '600' }}>
              {doctor?.degrees || 'MBBS, FCPS (Medicine), MD (Cardiology)'}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#64748B' }}>
              {doctor?.specialization || 'Medicine & Interventional Cardiology'}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: '2px' }}>
              BMDC Reg. No: <strong>{doctor?.bmdc_reg_no || 'A-45982'}</strong> | {doctor?.hospital_name || 'Dhaka Medical College & Hospital'}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              fontSize: '0.9rem', 
              fontWeight: '800', 
              color: '#0F52BA',
              letterSpacing: '0.05em' 
            }}>
              E-PRESCRIPTION
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '4px' }}>
              Rx No: <strong>{savedRxNumber}</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
              Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong>
            </div>
          </div>
        </div>

        {/* PATIENT DEMOGRAPHICS BAR */}
        <div style={{ 
          background: '#F8FAFC', 
          padding: '10px 14px', 
          borderRadius: '8px', 
          marginTop: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          fontSize: '0.8rem',
          gap: '8px'
        }}>
          <div><span style={{ color: '#64748B' }}>Patient:</span> <strong>{patient?.full_name || 'Md. Kabir Hossain'}</strong></div>
          <div><span style={{ color: '#64748B' }}>Age / Sex:</span> <strong>{patient?.age || 45}Y / {patient?.gender || 'Male'}</strong></div>
          <div><span style={{ color: '#64748B' }}>UID:</span> <strong>{patient?.patient_uid || 'PAT-2026-001'}</strong></div>
          <div><span style={{ color: '#64748B' }}>Blood Grp:</span> <strong>{patient?.blood_group || 'B+'}</strong></div>
          <div><span style={{ color: '#64748B' }}>Phone:</span> <strong>{patient?.phone || '+8801819000111'}</strong></div>
        </div>

        {/* VITALS STRIP */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px', 
          marginTop: '10px', 
          padding: '6px 14px', 
          background: '#EBF3FF', 
          borderRadius: '6px',
          fontSize: '0.78rem'
        }}>
          <HeartPulse size={15} color="#0F52BA" />
          <span>BP: <strong>{vitals.bp}</strong></span>
          <span>•</span>
          <span>Temp: <strong>{vitals.temp}</strong></span>
          <span>•</span>
          <span>Pulse: <strong>{vitals.pulse}</strong></span>
        </div>

        {/* DDI SAFETY ALERT BANNER */}
        {warnings.length > 0 && (
          <div style={{ 
            marginTop: '14px', 
            background: '#FEF2F2', 
            border: '1px solid #FCA5A5', 
            borderRadius: '8px', 
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <ShieldAlert size={22} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                CLINICAL DRUG-DRUG INTERACTION ALERT ({warnings.length} detected)
              </div>
              {warnings.map((w, idx) => (
                <div key={idx} style={{ fontSize: '0.78rem', color: '#7F1D1D', marginTop: '4px' }}>
                  <strong>{w.drugA} + {w.drugB} ({w.severity}):</strong> {w.description}
                  <div style={{ fontStyle: 'italic', color: '#B91C1C', marginTop: '2px' }}>
                    💡 Clinical Guidance: {w.clinicalAdvice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRESCRIPTION BODY: LEFT & RIGHT */}
        <div style={{ display: 'grid', gridTemplateColumns: '32% 68%', marginTop: '16px', gap: '20px' }}>
          
          {/* Clinical Notes (Left) */}
          <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: '14px' }}>
            
            {/* Complaints */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                Chief Complaints (লক্ষণসমূহ):
              </div>
              <ul style={{ paddingLeft: '16px', fontSize: '0.8rem', color: '#334155' }}>
                {complaints.map((c, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
                ))}
              </ul>
            </div>

            {/* Diagnosis */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                Clinical Diagnosis (রোগ নির্ণয়):
              </div>
              <div style={{ 
                fontSize: '0.82rem', 
                fontWeight: '700', 
                color: '#0F52BA', 
                background: '#F0F9FF', 
                padding: '6px 8px', 
                borderRadius: '6px' 
              }}>
                {diagnosis}
              </div>
            </div>

            {/* Investigations */}
            {investigations.length > 0 && (
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Investigations (পরীক্ষা-নিরীক্ষা):
                </div>
                <ul style={{ paddingLeft: '16px', fontSize: '0.78rem', color: '#475569' }}>
                  {investigations.map((inv, i) => (
                    <li key={i} style={{ marginBottom: '3px' }}>{inv}</li>
                  ))}
                </ul>
              </div>
            )}

          </div>

          {/* Rx Medications Grid (Right) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '900', color: '#0F52BA', fontStyle: 'italic' }}>
                ℞
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                Prescribed Medications (Grounded with DB):
              </span>
            </div>

            {/* Medicine Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {medicines.map((med, index) => (
                <div 
                  key={index} 
                  style={{ 
                    padding: '10px 14px', 
                    borderRadius: '8px', 
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        background: '#F1F5F9', 
                        color: '#475569', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontWeight: '700' 
                      }}>
                        {med.form}
                      </span>
                      <strong style={{ fontSize: '0.9rem', color: '#1E293B' }}>{med.brandName}</strong>
                      <span style={{ fontSize: '0.8rem', color: '#64748B' }}>({med.strength})</span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '2px' }}>
                      {med.genericName}
                    </div>

                    {/* Bengali Dosage Instruction */}
                    <div className="bangla-text" style={{ 
                      fontSize: '0.85rem', 
                      color: '#0F52BA', 
                      fontWeight: '600', 
                      marginTop: '4px' 
                    }}>
                      {med.dosagePattern} — {med.duration} ({med.instructionsBangla})
                    </div>
                  </div>

                  <button 
                    className="no-print"
                    onClick={() => onDeleteMedicine(index)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: '#94A3B8', 
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* Bengali Advice Box */}
            <div style={{ marginTop: '16px', background: '#F8FAFC', padding: '12px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div className="bangla-text" style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                  পরামর্শ (Patient Instructions in Bengali):
                </div>
                <button 
                  className="no-print"
                  onClick={() => onSpeakBangla(advice.join('. '))}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px', 
                    background: '#EBF3FF', 
                    border: 'none', 
                    color: '#0F52BA', 
                    padding: '3px 8px', 
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    cursor: 'pointer' 
                  }}
                >
                  <Volume2 size={13} /> বাংলায় শুনুন (Voice Readout)
                </button>
              </div>

              <ul className="bangla-text" style={{ paddingLeft: '18px', fontSize: '0.82rem', color: '#475569' }}>
                {advice.map((adv, i) => (
                  <li key={i} style={{ marginBottom: '3px' }}>{adv}</li>
                ))}
              </ul>
            </div>

          </div>

        </div>
      </div>

      {/* FOOTER: SIGNATURE & DISCLAIMER */}
      <div style={{ 
        borderTop: '1px solid #E2E8F0', 
        paddingTop: '14px', 
        marginTop: '24px', 
        display: 'flex', 
        alignItems: 'flex-end', 
        justifyContent: 'space-between' 
      }}>
        <div style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
          Generated via <strong>BanglaRx AI Engine</strong>. Verified by Attending Physician.<br />
          Powered by Google Gemini Neural Foundation & PostgreSQL 18 RAG.
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            fontFamily: 'cursive', 
            fontSize: '1.1rem', 
            color: '#0F52BA',
            borderBottom: '1px dashed #94A3B8',
            paddingBottom: '2px',
            marginBottom: '4px'
          }}>
            {doctor?.name || 'Dr. M. A. Rahman'}
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', color: '#64748B' }}>
            Registered Medical Practitioner
          </div>
        </div>
      </div>

    </div>
  );
};
