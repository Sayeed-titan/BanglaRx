import React, { useState } from 'react';
import { Stethoscope, ShieldAlert, Trash2, Volume2, Printer, QrCode, HeartPulse, Sparkles, AlertTriangle, Plus, X, Calendar, FileText, Clock } from 'lucide-react';
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
  patientReportsPresented?: string[];
  advice: string[];
  followUp?: string;
  emergencyRedFlags?: string;
  warnings: DrugWarning[];
  onDeleteMedicine: (index: number) => void;
  onUpdateMedicine: (index: number, field: keyof PrescriptionItem, value: string) => void;
  onAddInvestigation: (test: string) => void;
  onDeleteInvestigation: (index: number) => void;
  onAddPatientReport?: (report: string) => void;
  onDeletePatientReport?: (index: number) => void;
  onUpdateFollowUp?: (val: string) => void;
  onSpeakBangla: (text: string) => void;
  onOpenQrModal: () => void;
}

const COMMON_DOSAGES = ['1+0+1', '1+1+1', '1+0+0', '0+0+1', '৪ ঘণ্টা পর পর', '৬ ঘণ্টা পর পর', '৮ ঘণ্টা পর পর', 'জর আসলে ১টি (SOS)'];
const COMMON_DURATIONS = ['৩ দিন', '৫ দিন', '৭ দিন', '১৪ দিন', '১ মাস', 'চলবে (Continue)'];
const COMMON_INSTRUCTIONS = ['ভরা পেটে খাবেন', 'খাওয়ার ২০ মিনিট আগে', 'খাওয়ার মাঝে', 'খালি পেটে', 'জর ১০১° এর বেশি হলে'];
const COMMON_INVESTIGATIONS = ['CBC with ESR', 'Dengue NS1 Antigen', 'Serum Creatinine', 'HbA1c', 'SGPT (ALT)', 'USG of Whole Abdomen', 'Chest X-Ray', 'Urine R/E'];

export const PrescriptionPad: React.FC<PrescriptionPadProps> = ({
  doctor,
  patient,
  savedRxNumber,
  vitals,
  complaints,
  diagnosis,
  medicines,
  investigations,
  patientReportsPresented = [],
  advice,
  followUp = '৭ দিন পর রিপোর্টসহ দেখা করবেন',
  emergencyRedFlags = 'জ্বর ১০৩ ডিগ্রির বেশি হলে অথবা মাড়ি দিয়ে রক্তক্ষরণ হলে জরুরি বিভাগে যোগাযোগ করবেন',
  warnings,
  onDeleteMedicine,
  onUpdateMedicine,
  onAddInvestigation,
  onDeleteInvestigation,
  onAddPatientReport,
  onDeletePatientReport,
  onUpdateFollowUp,
  onSpeakBangla,
  onOpenQrModal,
}) => {
  const [customTest, setCustomTest] = useState('');
  const [customReport, setCustomReport] = useState('');
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);

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
          gridTemplateColumns: '270px 1fr',
          gap: '24px',
          marginTop: '20px',
          minHeight: '440px'
        }}>
          
          {/* LEFT CLINICAL COLUMN: VITALS, COMPLAINTS, REPORTS & INVESTIGATIONS */}
          <div style={{
            borderRight: '1px solid var(--slate-200)',
            paddingRight: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            
            {/* Vitals */}
            <div>
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
            <div>
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
            <div>
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

            {/* Patient Test Reports Presented Today (পূর্ববর্তী রিপোর্ট) */}
            {patientReportsPresented.length > 0 && (
              <div style={{
                background: 'var(--slate-50)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--slate-200)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <FileText size={13} color="var(--sapphire-600)" />
                  <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                    Reports Reviewed Today
                  </span>
                </div>
                <ul style={{ paddingLeft: '14px', fontSize: '0.74rem', color: 'var(--slate-700)', lineHeight: 1.45 }}>
                  {patientReportsPresented.map((rep, idx) => (
                    <li key={idx}>
                      <strong>{rep}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Investigations Advised (পরীক্ষা-নিরীক্ষা) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  Advised Tests ({investigations.length})
                </span>
              </div>

              {/* Advised Tests List with Delete Option */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                {investigations.map((inv, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--slate-50)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.76rem',
                      border: '1px solid var(--slate-200)'
                    }}
                  >
                    <span>{inv}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteInvestigation(i)}
                      className="no-print"
                      style={{ border: 'none', background: 'transparent', color: 'var(--slate-400)', cursor: 'pointer' }}
                      title="Remove test"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick Add Investigation Chips (Hidden during print) */}
              <div className="no-print" style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--slate-400)', marginBottom: '4px' }}>Quick Add Common Tests:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {COMMON_INVESTIGATIONS.map(test => (
                    <button
                      key={test}
                      type="button"
                      onClick={() => onAddInvestigation(test)}
                      style={{
                        fontSize: '0.68rem',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--slate-200)',
                        background: '#FFFFFF',
                        color: 'var(--teal-700)',
                        cursor: 'pointer'
                      }}
                    >
                      + {test}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Test Adder */}
              <div className="no-print" style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  placeholder="Custom test name..."
                  value={customTest}
                  onChange={e => setCustomTest(e.target.value)}
                  className="input-clinical"
                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customTest.trim()) {
                      e.preventDefault();
                      onAddInvestigation(customTest.trim());
                      setCustomTest('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customTest.trim()) {
                      onAddInvestigation(customTest.trim());
                      setCustomTest('');
                    }
                  }}
                  className="btn-clinical btn-outline"
                  style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                >
                  <Plus size={12} />
                </button>
              </div>
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

            {/* MEDICINES LIST WITH INLINE EDITORS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {medicines.map((med, index) => (
                <div
                  key={index}
                  className="anim-slide-up"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Medicine Brand, Generic & Strength */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.76rem',
                        fontWeight: '700',
                        color: 'var(--slate-400)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        #{index + 1}
                      </span>
                      <strong style={{ fontSize: '0.96rem', color: 'var(--slate-900)' }}>
                        {med.brandName}
                      </strong>
                      <span className="badge-clinical badge-teal" style={{ fontSize: '0.7rem' }}>
                        {med.form} • {med.strength}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--slate-500)' }}>
                        ({med.genericName})
                      </span>
                    </div>

                    {/* Delete Item (No-Print) */}
                    <button
                      type="button"
                      onClick={() => onDeleteMedicine(index)}
                      className="no-print btn-clinical btn-outline"
                      style={{
                        padding: '5px',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--crimson-600)',
                        borderColor: 'transparent'
                      }}
                      title="Remove medicine"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Inline Editable Controls: Dosage, Duration, Bengali Meal Instruction */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1.8fr',
                    gap: '10px',
                    marginTop: '2px',
                    background: '#FFFFFF',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--slate-200)'
                  }}>
                    {/* Dosage Frequency Picker */}
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: '700', textTransform: 'uppercase' }}>
                        Dosage Pattern
                      </label>
                      <select
                        value={med.dosagePattern}
                        onChange={e => onUpdateMedicine(index, 'dosagePattern', e.target.value)}
                        className="select-clinical"
                        style={{ padding: '4px 6px', fontSize: '0.78rem', marginTop: '2px', fontWeight: '700' }}
                      >
                        {COMMON_DOSAGES.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                        {!COMMON_DOSAGES.includes(med.dosagePattern) && (
                          <option value={med.dosagePattern}>{med.dosagePattern}</option>
                        )}
                      </select>
                    </div>

                    {/* Duration Picker */}
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: '700', textTransform: 'uppercase' }}>
                        Duration
                      </label>
                      <select
                        value={med.duration}
                        onChange={e => onUpdateMedicine(index, 'duration', e.target.value)}
                        className="select-clinical"
                        style={{ padding: '4px 6px', fontSize: '0.78rem', marginTop: '2px' }}
                      >
                        {COMMON_DURATIONS.map(dur => (
                          <option key={dur} value={dur}>{dur}</option>
                        ))}
                        {!COMMON_DURATIONS.includes(med.duration) && (
                          <option value={med.duration}>{med.duration}</option>
                        )}
                      </select>
                    </div>

                    {/* Instructions in Bengali */}
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--slate-400)', fontWeight: '700', textTransform: 'uppercase' }}>
                        নির্দেশিকা (Timing)
                      </label>
                      <select
                        value={med.instructionsBangla}
                        onChange={e => onUpdateMedicine(index, 'instructionsBangla', e.target.value)}
                        className="select-clinical font-bangla"
                        style={{ padding: '4px 6px', fontSize: '0.8rem', marginTop: '2px', color: 'var(--teal-800)', fontWeight: '600' }}
                      >
                        {COMMON_INSTRUCTIONS.map(ins => (
                          <option key={ins} value={ins}>{ins}</option>
                        ))}
                        {!COMMON_INSTRUCTIONS.includes(med.instructionsBangla) && (
                          <option value={med.instructionsBangla}>{med.instructionsBangla}</option>
                        )}
                      </select>
                    </div>
                  </div>

                </div>
              ))}
            </div>

            {/* ADVICE IN BENGALI SECTION */}
            <div style={{
              marginTop: '20px',
              paddingTop: '14px',
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

            {/* FOLLOW-UP & EMERGENCY RED FLAGS */}
            <div style={{
              marginTop: '16px',
              background: 'var(--slate-50)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} color="var(--teal-600)" />
                  <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--slate-800)' }}>
                    পরবর্তী সাক্ষাৎ (Follow-up):
                  </span>
                  <span className="font-bangla" style={{ fontSize: '0.8rem', color: 'var(--teal-800)', fontWeight: '700' }}>
                    {followUp}
                  </span>
                </div>

                {onUpdateFollowUp && (
                  <div className="no-print" style={{ display: 'flex', gap: '4px' }}>
                    {['৩ দিন পর', '৭ দিন পর', '১৪ দিন পর', '১ মাস পর'].map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => onUpdateFollowUp(`${f} রিপোর্টসহ দেখা করবেন`)}
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--slate-200)',
                          background: '#FFFFFF',
                          cursor: 'pointer'
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Emergency Red Flags warning */}
              <div style={{ fontSize: '0.72rem', color: 'var(--crimson-700)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} />
                <span className="font-bangla">{emergencyRedFlags}</span>
              </div>
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
