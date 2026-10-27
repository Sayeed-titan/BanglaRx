import React from 'react';
import { Stethoscope, ShieldAlert, Trash2, Volume2, Printer, QrCode, HeartPulse, Sparkles, AlertTriangle } from 'lucide-react';
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
  onOpenQrModal: () => void;
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
  onOpenQrModal,
}) => {
  return (
    <div
      className="rx-paper clinical-card"
      style={{
        padding: '32px',
        minHeight: '840px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#FFFFFF',
        border: '1px solid var(--slate-200)',
        boxShadow: 'var(--shadow-elevated)'
      }}
    >
      <div>
        
        {/* TOP OFFICIAL BMDC DOCTOR HEADER */}
        <div style={{
          borderBottom: '2px solid var(--slate-900)',
          paddingBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.35rem',
              fontWeight: '800',
              color: 'var(--slate-900)',
              letterSpacing: '-0.02em'
            }}>
              {doctor?.name || 'Prof. Dr. M. A. Rahman'}
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--teal-700)', fontWeight: '700', marginTop: '2px' }}>
              {doctor?.degrees || 'MBBS, FCPS (Medicine), MD (Cardiology)'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--slate-600)', marginTop: '1px' }}>
              {doctor?.specialization || 'Clinical Medicine & Interventional Cardiology'}
            </p>
            <p style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginTop: '4px' }}>
              BMDC Reg. No: <strong style={{ color: 'var(--slate-800)' }}>{doctor?.bmdc_reg_no || 'A-45982'}</strong> • {doctor?.hospital_name || 'Dhaka Medical College & Hospital'} • Room: {doctor?.room_no || 'Chamber 402'}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '0.82rem',
              fontWeight: '800',
              color: 'var(--slate-900)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              Official E-Prescription
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '3px' }}>
              Rx ID: <strong style={{ color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>{savedRxNumber}</strong>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)', marginTop: '1px' }}>
              Date: <strong style={{ color: 'var(--slate-900)' }}>{new Date().toLocaleDateString('en-GB')}</strong>
            </div>

            {/* Quick Pad Action Toolbar (Hidden during print) */}
            <div className="no-print" style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-clinical btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.74rem' }}
                title="Print Prescription Pad"
              >
                <Printer size={13} />
                <span>Print Rx</span>
              </button>

              <button
                type="button"
                onClick={onOpenQrModal}
                className="btn-clinical btn-primary-slate"
                style={{ padding: '6px 12px', fontSize: '0.74rem' }}
                title="Open Patient Mobile View"
              >
                <QrCode size={13} />
                <span>QR View</span>
              </button>
            </div>
          </div>
        </div>

        {/* PATIENT DEMOGRAPHICS BAR */}
        <div style={{
          background: 'var(--slate-50)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          fontSize: '0.8rem',
          gap: '12px',
          border: '1px solid var(--slate-200)'
        }}>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.74rem' }}>Patient Name:</span>
            <div style={{ fontWeight: '700', color: 'var(--slate-900)' }}>{patient?.full_name || 'Md. Kabir Hossain'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.74rem' }}>Age / Sex:</span>
            <div style={{ fontWeight: '700', color: 'var(--slate-900)' }}>{patient?.age || 45}Y / {patient?.gender || 'Male'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.74rem' }}>Blood Group:</span>
            <div style={{ fontWeight: '700', color: 'var(--crimson-700)' }}>{patient?.blood_group || 'B+ Positive'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.74rem' }}>Contact Phone:</span>
            <div style={{ fontWeight: '600', color: 'var(--slate-800)' }}>{patient?.phone || '01712-XXXXXX'}</div>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.74rem' }}>Known Allergies:</span>
            <div style={{ fontWeight: '600', color: 'var(--amber-700)' }}>{patient?.allergies || 'None Reported'}</div>
          </div>
        </div>

        {/* CRITICAL DRUG-DRUG INTERACTION (DDI) SAFETY INTERCEPT CARD */}
        {warnings.length > 0 && (
          <div
            className="anim-slide-up"
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              background: 'var(--crimson-50)',
              border: '1px solid var(--crimson-100)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <div style={{
              background: 'var(--crimson-600)',
              color: '#FFFFFF',
              padding: '7px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              marginTop: '2px'
            }}>
              <ShieldAlert size={18} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.84rem',
                  fontWeight: '800',
                  color: 'var(--crimson-900)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Clinical Contraindication Intercept
                </span>
                <span className="badge-clinical badge-crimson">
                  HIGH SEVERITY DDI
                </span>
              </div>

              {warnings.map((w, i) => (
                <div key={i} style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--crimson-900)' }}>
                  <strong>Conflict:</strong> {w.drugA} + {w.drugB}
                  <p style={{ marginTop: '2px', color: 'var(--crimson-700)', lineHeight: 1.45 }}>
                    {w.description}
                  </p>
                  <p style={{ marginTop: '3px', fontWeight: '700', color: 'var(--crimson-900)' }}>
                    Clinical Recommendation: {w.clinicalAdvice}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MAIN CLINICAL CONTENT GRID (SPLIT COLUMN: FINDINGS VS RX) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: '24px',
          marginTop: '20px',
          minHeight: '440px'
        }}>
          
          {/* LEFT CLINICAL COLUMN: VITALS, COMPLAINTS, INVESTIGATIONS */}
          <div style={{
            borderRight: '1px solid var(--slate-200)',
            paddingRight: '18px'
          }}>
            
            {/* Vitals */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <HeartPulse size={14} color="var(--teal-600)" />
                <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  Recorded Vitals
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '5px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>BP:</span>
                  <strong style={{ color: 'var(--slate-900)' }}>{vitals.bp}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '5px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Temp:</span>
                  <strong style={{ color: 'var(--crimson-700)' }}>{vitals.temp}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '5px 8px', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Pulse:</span>
                  <strong style={{ color: 'var(--slate-900)' }}>{vitals.pulse}</strong>
                </div>
              </div>
            </div>

            {/* Chief Complaints */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                Chief Complaints
              </span>
              <ul style={{ marginTop: '6px', paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--slate-700)', lineHeight: 1.5 }}>
                {complaints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            {/* Diagnosis */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                Clinical Diagnosis
              </span>
              <div style={{
                marginTop: '6px',
                fontSize: '0.8rem',
                fontWeight: '700',
                color: 'var(--teal-800)',
                background: 'var(--teal-50)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--teal-100)'
              }}>
                {diagnosis}
              </div>
            </div>

            {/* Investigations */}
            <div>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                Investigations Advised
              </span>
              <ul style={{ marginTop: '6px', paddingLeft: '16px', fontSize: '0.78rem', color: 'var(--slate-700)', lineHeight: 1.5 }}>
                {investigations.map((inv, i) => (
                  <li key={i}>{inv}</li>
                ))}
              </ul>
            </div>

          </div>

          {/* RIGHT COLUMN: OFFICIAL RX SECTION */}
          <div style={{ paddingLeft: '4px' }}>
            
            {/* Rx Symbol Header */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--slate-200)',
              paddingBottom: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{
                  fontSize: '1.8rem',
                  fontFamily: 'serif',
                  fontWeight: '800',
                  color: 'var(--slate-900)',
                  lineHeight: 1
                }}>
                  ℞
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--slate-500)', fontWeight: '600' }}>
                  Prescribed Pharmacotherapy ({medicines.length} Medicines)
                </span>
              </div>

              {/* Read Aloud Button in Bengali */}
              <button
                type="button"
                onClick={() => {
                  const speech = medicines.map((m, idx) => 
                    `${idx + 1}. ${m.brandName}, ${m.dosagePattern}, ${m.instructionsBangla}`
                  ).join('। ');
                  onSpeakBangla(`ঔষধ সেবনের নির্দেশিকা: ${speech}`);
                }}
                className="btn-clinical btn-outline no-print"
                style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                title="Read prescription in Bengali"
              >
                <Volume2 size={13} color="var(--teal-600)" />
                <span className="font-bangla">অডিও শুনুন (Bangla)</span>
              </button>
            </div>

            {/* MEDICINES LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {medicines.map((med, index) => (
                <div
                  key={index}
                  className="anim-slide-up"
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        color: 'var(--slate-400)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        #{index + 1}
                      </span>
                      <strong style={{ fontSize: '0.94rem', color: 'var(--slate-900)' }}>
                        {med.brandName}
                      </strong>
                      <span className="badge-clinical badge-teal" style={{ fontSize: '0.7rem' }}>
                        {med.form} • {med.strength}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                        ({med.genericName})
                      </span>
                    </div>

                    {/* Dosage, Duration & Bengali Instructions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '6px',
                      flexWrap: 'wrap',
                      fontSize: '0.8rem'
                    }}>
                      <div style={{
                        background: '#FFFFFF',
                        border: '1px solid var(--slate-300)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: '700',
                        color: 'var(--slate-800)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        {med.dosagePattern}
                      </div>

                      <div style={{ color: 'var(--slate-600)', fontWeight: '600' }}>
                        ⏱️ {med.duration}
                      </div>

                      <div className="font-bangla" style={{
                        color: 'var(--teal-800)',
                        fontWeight: '600',
                        fontSize: '0.84rem'
                      }}>
                        {med.instructionsBangla}
                      </div>
                    </div>
                  </div>

                  {/* Delete Item (No-Print) */}
                  <button
                    type="button"
                    onClick={() => onDeleteMedicine(index)}
                    className="no-print btn-clinical btn-outline"
                    style={{
                      padding: '6px',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--crimson-600)',
                      borderColor: 'transparent'
                    }}
                    title="Remove medicine"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* ADVICE IN BENGALI SECTION */}
            <div style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px dashed var(--slate-200)'
            }}>
              <span style={{
                fontSize: '0.76rem',
                fontWeight: '800',
                color: 'var(--slate-800)',
                textTransform: 'uppercase'
              }}>
                পরামর্শ ও খাদ্যবিধি (Doctor's Advice in Bengali):
              </span>
              <ul className="font-bangla" style={{
                marginTop: '6px',
                paddingLeft: '18px',
                fontSize: '0.86rem',
                color: 'var(--slate-700)',
                lineHeight: 1.6
              }}>
                {advice.map((adv, i) => (
                  <li key={i}>{adv}</li>
                ))}
              </ul>
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER OF PRESCRIPTION PAD (SIGNATURE & REGISTRATION) */}
      <div style={{
        marginTop: '36px',
        paddingTop: '16px',
        borderTop: '1px solid var(--slate-200)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        fontSize: '0.74rem',
        color: 'var(--slate-500)'
      }}>
        <div>
          <div style={{ color: 'var(--slate-700)', fontWeight: '600' }}>
            Generated by <strong>BanglaRx AI™</strong>
          </div>
          <div style={{ color: 'var(--slate-400)', fontSize: '0.7rem', marginTop: '1px' }}>
            Clinical Decision Support System • DGDA Standard
          </div>
        </div>

        <div style={{ textAlign: 'center', minWidth: '180px' }}>
          <div style={{
            fontFamily: 'serif',
            fontStyle: 'italic',
            fontSize: '1rem',
            color: 'var(--teal-800)',
            marginBottom: '4px'
          }}>
            {doctor?.name || 'Dr. Tanvir Ahmed'}
          </div>
          <div style={{ borderTop: '1px solid var(--slate-400)', paddingTop: '4px' }}>
            Registered Physician's Signature
          </div>
        </div>
      </div>

    </div>
  );
};
