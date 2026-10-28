import React, { useState } from 'react';
import { Stethoscope, ShieldAlert, Trash2, Volume2, Printer, QrCode, HeartPulse, Sparkles, AlertTriangle, Plus, X, Calendar, FileText, Clock, Edit2, Check, UserCheck } from 'lucide-react';
import type { Doctor, Patient, PrescriptionItem, DrugWarning } from '../types/index';

interface PrescriptionPadProps {
  doctor: Doctor | null;
  patient: Patient | null;
  savedRxNumber: string;
  vitals: { bp?: string; temp?: string; pulse?: string; spo2?: string; height?: string; weight?: string };
  complaints: string[];
  diagnosis: string;
  medicines: PrescriptionItem[];
  investigations: string[];
  patientReportsPresented?: string[];
  advice: string[];
  followUp?: string;
  emergencyRedFlags?: string;
  referredTo?: string;
  warnings: DrugWarning[];
  onDeleteMedicine: (index: number) => void;
  onUpdateMedicine: (index: number, field: keyof PrescriptionItem, value: string) => void;
  onAddInvestigation: (test: string) => void;
  onDeleteInvestigation: (index: number) => void;
  onAddPatientReport?: (report: string) => void;
  onDeletePatientReport?: (index: number) => void;
  onAddComplaint?: (comp: string) => void;
  onDeleteComplaint?: (index: number) => void;
  onUpdateDiagnosis?: (diag: string) => void;
  onAddAdvice?: (adv: string) => void;
  onDeleteAdvice?: (index: number) => void;
  onUpdateFollowUp?: (val: string) => void;
  onUpdateReferredTo?: (val: string) => void;
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
  referredTo = '',
  warnings,
  onDeleteMedicine,
  onUpdateMedicine,
  onAddInvestigation,
  onDeleteInvestigation,
  onAddPatientReport,
  onDeletePatientReport,
  onAddComplaint,
  onDeleteComplaint,
  onUpdateDiagnosis,
  onAddAdvice,
  onDeleteAdvice,
  onUpdateFollowUp,
  onUpdateReferredTo,
  onSpeakBangla,
  onOpenQrModal,
}) => {
  const [customTest, setCustomTest] = useState('');
  const [customComplaint, setCustomComplaint] = useState('');
  const [customAdvice, setCustomAdvice] = useState('');
  const [customReferral, setCustomReferral] = useState(referredTo);
  const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
  const [tempDiagnosis, setTempDiagnosis] = useState(diagnosis);
  const [isEditingFollowUp, setIsEditingFollowUp] = useState(false);
  const [tempFollowUp, setTempFollowUp] = useState(followUp);
  const [generalSigns, setGeneralSigns] = useState({
    anaemia: 'Nil',
    jaundice: 'Absent',
    oedema: 'Nil',
    cyanosis: 'Absent',
    dehydration: 'None',
    lymphNodes: 'Not palpable'
  });
  const [examNotes, setExamNotes] = useState('');
  const [isEditingExamNotes, setIsEditingExamNotes] = useState(false);

  return (
    <div
      className="rx-paper clinical-card"
      style={{
        padding: '24px 28px',
        minHeight: '760px',
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
          paddingBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: '800',
              color: 'var(--slate-900)',
              letterSpacing: '-0.02em'
            }}>
              {doctor?.name || 'Prof. Dr. M. A. Rahman'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--teal-700)', fontWeight: '700', marginTop: '1px' }}>
              {doctor?.degrees || 'MBBS, FCPS (Medicine), MD (Cardiology)'}
            </p>
            <p style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '1px' }}>
              {doctor?.specialization || 'Clinical Medicine & Interventional Cardiology'}
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)', marginTop: '3px' }}>
              BMDC Reg. No: <strong style={{ color: 'var(--slate-800)' }}>{doctor?.bmdc_reg_no || 'A-45982'}</strong> • {doctor?.hospital_name || 'Dhaka Medical College & Hospital'} • Room: {doctor?.room_no || 'Chamber 402'}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: '800',
              color: 'var(--slate-900)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              Official E-Prescription
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginTop: '2px' }}>
              Rx ID: <strong style={{ color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>{savedRxNumber}</strong>
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginTop: '1px' }}>
              Date: <strong style={{ color: 'var(--slate-900)' }}>{new Date().toLocaleDateString('en-GB')}</strong>
            </div>

            {/* Quick Pad Action Toolbar (Hidden during print) */}
            <div className="no-print" style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-clinical btn-outline"
                style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                title="Print Prescription Pad (A4)"
              >
                <Printer size={13} />
                <span>Print Rx (A4)</span>
              </button>

              <button
                type="button"
                onClick={onOpenQrModal}
                className="btn-clinical btn-primary-slate"
                style={{ padding: '5px 12px', fontSize: '0.74rem' }}
                title="Open Patient Mobile View"
              >
                <QrCode size={13} />
                <span>QR View</span>
              </button>
            </div>
          </div>
        </div>

        {/* PATIENT DEMOGRAPHICS BAR (Spacious, Responsive, Non-Wrapping) */}
        <div style={{
          background: 'var(--slate-50)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          marginTop: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          gap: '6px 14px',
          border: '1px solid var(--slate-200)'
        }}>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.72rem' }}>Patient Name: </span>
            <strong style={{ color: 'var(--slate-900)' }}>{patient?.full_name || 'Md. Kabir Hossain'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.72rem' }}>Age / Sex: </span>
            <strong style={{ color: 'var(--slate-900)' }}>{patient?.age || 45}Y / {patient?.gender || 'Male'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.72rem' }}>Blood Group: </span>
            <strong style={{ color: 'var(--crimson-700)' }}>{patient?.blood_group || 'B+ Positive'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.72rem' }}>Contact Phone: </span>
            <strong style={{ color: 'var(--slate-800)' }}>{patient?.phone || '01712-XXXXXX'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--slate-500)', fontSize: '0.72rem' }}>Known Allergies: </span>
            <strong style={{ color: patient?.allergies && patient.allergies !== 'None Reported' ? 'var(--amber-700)' : 'var(--slate-700)' }}>
              {patient?.allergies || 'None Reported'}
            </strong>
          </div>
        </div>

        {/* CRITICAL DRUG-DRUG INTERACTION (DDI) SAFETY INTERCEPT CARD */}
        {warnings.length > 0 && (
          <div
            className="anim-slide-up"
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              background: 'var(--crimson-50)',
              border: '1px solid var(--crimson-100)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            <div style={{
              background: 'var(--crimson-600)',
              color: '#FFFFFF',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              marginTop: '2px'
            }}>
              <ShieldAlert size={16} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.82rem',
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
                <div key={i} style={{ marginTop: '4px', fontSize: '0.78rem', color: 'var(--crimson-900)' }}>
                  <strong>Conflict:</strong> {w.drugA} + {w.drugB}
                  <p style={{ marginTop: '2px', color: 'var(--crimson-700)', lineHeight: 1.4 }}>
                    {w.description}
                  </p>
                  <p style={{ marginTop: '2px', fontWeight: '700', color: 'var(--crimson-900)' }}>
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
          gridTemplateColumns: '230px 1fr',
          gap: '20px',
          marginTop: '14px'
        }}>
          
          {/* LEFT CLINICAL COLUMN: VITALS, COMPLAINTS, REPORTS & INVESTIGATIONS */}
          <div style={{
            borderRight: '1px solid var(--slate-200)',
            paddingRight: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            
            {/* Vitals */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <HeartPulse size={13} color="var(--teal-600)" />
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  Recorded Vitals
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.74rem' }}>
                {vitals?.bp && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '3px 6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--slate-500)' }}>BP:</span>
                    <strong style={{ color: 'var(--slate-900)' }}>{vitals.bp}</strong>
                  </div>
                )}
                {vitals?.temp && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '3px 6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--slate-500)' }}>Temp:</span>
                    <strong style={{ color: 'var(--crimson-700)' }}>{vitals.temp}</strong>
                  </div>
                )}
                {vitals?.pulse && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '3px 6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--slate-500)' }}>Pulse:</span>
                    <strong style={{ color: 'var(--slate-900)' }}>{vitals.pulse}</strong>
                  </div>
                )}
                {vitals?.spo2 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '3px 6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--slate-500)' }}>SpO2:</span>
                    <strong style={{ color: 'var(--teal-700)' }}>{vitals.spo2}</strong>
                  </div>
                )}
                {vitals?.height && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '3px 6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--slate-500)' }}>Height:</span>
                    <strong style={{ color: 'var(--slate-800)' }}>{vitals.height}</strong>
                  </div>
                )}
                {vitals?.weight && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--slate-50)', padding: '3px 6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--slate-500)' }}>Weight:</span>
                    <strong style={{ color: 'var(--slate-800)' }}>{vitals.weight}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* General Examination (G/E) Physical Signs Checklist */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  General Exam (G/E)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', fontSize: '0.68rem' }}>
                <div style={{ background: 'var(--slate-50)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Anaemia: </span>
                  <select
                    value={generalSigns.anaemia}
                    onChange={e => setGeneralSigns(prev => ({ ...prev, anaemia: e.target.value }))}
                    className="select-clinical-clean"
                    style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '0.68rem', color: generalSigns.anaemia !== 'Nil' ? 'var(--crimson-700)' : 'var(--slate-800)', padding: 0 }}
                  >
                    <option value="Nil">Nil</option>
                    <option value="Mild (+)">Mild (+)</option>
                    <option value="Moderate (++)">Mod (++)</option>
                    <option value="Severe (+++)">Sev (+++)</option>
                  </select>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Jaundice: </span>
                  <select
                    value={generalSigns.jaundice}
                    onChange={e => setGeneralSigns(prev => ({ ...prev, jaundice: e.target.value }))}
                    className="select-clinical-clean"
                    style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '0.68rem', color: generalSigns.jaundice !== 'Absent' ? 'var(--amber-700)' : 'var(--slate-800)', padding: 0 }}
                  >
                    <option value="Absent">Absent</option>
                    <option value="Mild (+)">Mild (+)</option>
                    <option value="Deep (++)">Deep (++)</option>
                  </select>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Oedema: </span>
                  <select
                    value={generalSigns.oedema}
                    onChange={e => setGeneralSigns(prev => ({ ...prev, oedema: e.target.value }))}
                    className="select-clinical-clean"
                    style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '0.68rem', color: generalSigns.oedema !== 'Nil' ? 'var(--crimson-700)' : 'var(--slate-800)', padding: 0 }}
                  >
                    <option value="Nil">Nil</option>
                    <option value="Mild (+)">Mild (+)</option>
                    <option value="Pitting (++)">Pitting (++)</option>
                  </select>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Cyanosis: </span>
                  <select
                    value={generalSigns.cyanosis}
                    onChange={e => setGeneralSigns(prev => ({ ...prev, cyanosis: e.target.value }))}
                    className="select-clinical-clean"
                    style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '0.68rem', color: generalSigns.cyanosis !== 'Absent' ? 'var(--crimson-700)' : 'var(--slate-800)', padding: 0 }}
                  >
                    <option value="Absent">Absent</option>
                    <option value="Present (+)">Present (+)</option>
                  </select>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Dehydration: </span>
                  <select
                    value={generalSigns.dehydration}
                    onChange={e => setGeneralSigns(prev => ({ ...prev, dehydration: e.target.value }))}
                    className="select-clinical-clean"
                    style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '0.68rem', color: generalSigns.dehydration !== 'None' ? 'var(--crimson-700)' : 'var(--slate-800)', padding: 0 }}
                  >
                    <option value="None">None</option>
                    <option value="Some (+)">Some (+)</option>
                    <option value="Severe (++)">Sev (++)</option>
                  </select>
                </div>

                <div style={{ background: 'var(--slate-50)', padding: '2px 5px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Lymph Node: </span>
                  <select
                    value={generalSigns.lymphNodes}
                    onChange={e => setGeneralSigns(prev => ({ ...prev, lymphNodes: e.target.value }))}
                    className="select-clinical-clean"
                    style={{ border: 'none', background: 'transparent', fontWeight: '700', fontSize: '0.68rem', color: generalSigns.lymphNodes !== 'Not palpable' ? 'var(--crimson-700)' : 'var(--slate-800)', padding: 0 }}
                  >
                    <option value="Not palpable">Not palpable</option>
                    <option value="Cervical (+)">Cervical (+)</option>
                    <option value="Enlarged (+)">Enlarged (+)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* On Examination (O/E) Custom Findings */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  On Examination (O/E)
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingExamNotes(!isEditingExamNotes)}
                  className="no-print"
                  style={{ border: 'none', background: 'transparent', color: 'var(--teal-700)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 600 }}
                >
                  {isEditingExamNotes ? 'Done' : '+ Add O/E'}
                </button>
              </div>

              {isEditingExamNotes ? (
                <textarea
                  value={examNotes}
                  onChange={e => setExamNotes(e.target.value)}
                  placeholder="e.g. Chest: Clear, breath sounds vesicular. Heart: S1+S2 audible. Abdomen: Soft, non-tender..."
                  rows={2}
                  className="textarea-clinical no-print"
                  style={{ fontSize: '0.72rem', padding: '4px 6px', width: '100%', lineHeight: 1.4 }}
                />
              ) : examNotes ? (
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--slate-700)',
                  background: 'var(--slate-50)',
                  padding: '4px 6px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--slate-200)',
                  lineHeight: 1.4
                }}>
                  {examNotes}
                </div>
              ) : null}
            </div>

            {/* Chief Complaints with Manual Override */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  Chief Complaints
                </span>
              </div>
              <ul style={{ paddingLeft: '14px', fontSize: '0.76rem', color: 'var(--slate-700)', lineHeight: 1.45 }}>
                {complaints.map((c, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>{c}</span>
                    {onDeleteComplaint && (
                      <button
                        type="button"
                        onClick={() => onDeleteComplaint(i)}
                        className="no-print"
                        style={{ border: 'none', background: 'transparent', color: 'var(--slate-400)', cursor: 'pointer', padding: '0 2px' }}
                        title="Remove complaint"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {/* Add Custom Complaint (No-Print) */}
              {onAddComplaint && (
                <div className="no-print" style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="Add symptom..."
                    value={customComplaint}
                    onChange={e => setCustomComplaint(e.target.value)}
                    className="input-clinical"
                    style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customComplaint.trim()) {
                        e.preventDefault();
                        onAddComplaint(customComplaint.trim());
                        setCustomComplaint('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customComplaint.trim()) {
                        onAddComplaint(customComplaint.trim());
                        setCustomComplaint('');
                      }
                    }}
                    className="btn-clinical btn-outline"
                    style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                  >
                    <Plus size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* Diagnosis with Inline Edit */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  Clinical Diagnosis
                </span>
                {onUpdateDiagnosis && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingDiagnosis && tempDiagnosis.trim()) {
                        onUpdateDiagnosis(tempDiagnosis.trim());
                      }
                      setIsEditingDiagnosis(!isEditingDiagnosis);
                    }}
                    className="no-print"
                    style={{ border: 'none', background: 'transparent', color: 'var(--teal-700)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', fontWeight: 600 }}
                  >
                    {isEditingDiagnosis ? <Check size={11} /> : <Edit2 size={11} />}
                    <span>{isEditingDiagnosis ? 'Save' : 'Edit'}</span>
                  </button>
                )}
              </div>

              {isEditingDiagnosis ? (
                <input
                  type="text"
                  value={tempDiagnosis}
                  onChange={e => setTempDiagnosis(e.target.value)}
                  className="input-clinical no-print"
                  style={{ padding: '4px 6px', fontSize: '0.78rem', width: '100%' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      onUpdateDiagnosis?.(tempDiagnosis);
                      setIsEditingDiagnosis(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <div style={{
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  color: 'var(--teal-800)',
                  background: 'var(--teal-50)',
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--teal-100)'
                }}>
                  {diagnosis}
                </div>
              )}
            </div>

            {/* Patient Test Reports Presented Today (পূর্ববর্তী রিপোর্ট) */}
            {patientReportsPresented.length > 0 && (
              <div style={{
                background: 'var(--slate-50)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--slate-200)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                  <FileText size={12} color="var(--sapphire-600)" />
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                    Reports Reviewed Today
                  </span>
                </div>
                <ul style={{ paddingLeft: '12px', fontSize: '0.72rem', color: 'var(--slate-700)', lineHeight: 1.4 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)', textTransform: 'uppercase' }}>
                  Advised Tests ({investigations.length})
                </span>
              </div>

              {/* Advised Tests List with Delete Option */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                {investigations.map((inv, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--slate-50)',
                      padding: '3px 6px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.74rem',
                      border: '1px solid var(--slate-200)'
                    }}
                  >
                    <span>{inv}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteInvestigation(i)}
                      className="no-print"
                      style={{ border: 'none', background: 'transparent', color: 'var(--slate-400)', cursor: 'pointer', padding: '0 2px' }}
                      title="Remove test"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick Add Investigation Chips (Hidden during print) */}
              <div className="no-print" style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {COMMON_INVESTIGATIONS.slice(0, 5).map(test => (
                    <button
                      key={test}
                      type="button"
                      onClick={() => onAddInvestigation(test)}
                      style={{
                        fontSize: '0.66rem',
                        padding: '1px 5px',
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
              <div className="no-print" style={{ display: 'flex', gap: '3px' }}>
                <input
                  type="text"
                  placeholder="Custom test name..."
                  value={customTest}
                  onChange={e => setCustomTest(e.target.value)}
                  className="input-clinical"
                  style={{ padding: '3px 6px', fontSize: '0.72rem' }}
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
                  style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                >
                  <Plus size={11} />
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: OFFICIAL RX SECTION */}
          <div style={{ paddingLeft: '2px' }}>
            
            {/* Rx Symbol Header */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--slate-200)',
              paddingBottom: '6px',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{
                  fontSize: '1.6rem',
                  fontFamily: 'serif',
                  fontWeight: '800',
                  color: 'var(--slate-900)',
                  lineHeight: 1
                }}>
                  ℞
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--slate-500)', fontWeight: '600' }}>
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
                style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                title="Read prescription in Bengali"
              >
                <Volume2 size={12} color="var(--teal-600)" />
                <span className="font-bangla">অডিও শুনুন (Bangla)</span>
              </button>
            </div>

            {/* MEDICINES LIST WITH DUAL MODE: INTERACTIVE ON SCREEN, PRISTINE ON PRINT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {medicines.map((med, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--slate-50)',
                    border: '1px solid var(--slate-200)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    pageBreakInside: 'avoid'
                  }}
                >
                  {/* Medicine Brand, Generic & Strength */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: 'var(--slate-400)',
                        fontFamily: 'var(--font-mono)'
                      }}>
                        #{index + 1}
                      </span>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--slate-900)' }}>
                        {med.brandName}
                      </strong>
                      <span className="badge-clinical badge-teal" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                        {med.form} • {med.strength}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                        ({med.genericName})
                      </span>
                    </div>

                    {/* Delete Item (No-Print) */}
                    <button
                      type="button"
                      onClick={() => onDeleteMedicine(index)}
                      className="no-print btn-clinical btn-outline"
                      style={{
                        padding: '3px',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--crimson-600)',
                        borderColor: 'transparent'
                      }}
                      title="Remove medicine"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* 1. INTERACTIVE SCREEN CONTROLS (Hidden during print) */}
                  <div className="no-print" style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr 1.8fr',
                    gap: '8px',
                    marginTop: '2px',
                    background: '#FFFFFF',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--slate-200)'
                  }}>
                    {/* Dosage Frequency Picker */}
                    <div>
                      <label style={{ fontSize: '0.64rem', color: 'var(--slate-400)', fontWeight: '700', textTransform: 'uppercase' }}>
                        Dosage Pattern
                      </label>
                      <select
                        value={med.dosagePattern}
                        onChange={e => onUpdateMedicine(index, 'dosagePattern', e.target.value)}
                        className="select-clinical"
                        style={{ padding: '3px 5px', fontSize: '0.74rem', marginTop: '1px', fontWeight: '700' }}
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
                      <label style={{ fontSize: '0.64rem', color: 'var(--slate-400)', fontWeight: '700', textTransform: 'uppercase' }}>
                        Duration
                      </label>
                      <select
                        value={med.duration}
                        onChange={e => onUpdateMedicine(index, 'duration', e.target.value)}
                        className="select-clinical"
                        style={{ padding: '3px 5px', fontSize: '0.74rem', marginTop: '1px' }}
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
                      <label style={{ fontSize: '0.64rem', color: 'var(--slate-400)', fontWeight: '700', textTransform: 'uppercase' }}>
                        নির্দেশিকা (Timing)
                      </label>
                      <select
                        value={med.instructionsBangla}
                        onChange={e => onUpdateMedicine(index, 'instructionsBangla', e.target.value)}
                        className="select-clinical font-bangla"
                        style={{ padding: '3px 5px', fontSize: '0.76rem', marginTop: '1px', color: 'var(--teal-800)', fontWeight: '600' }}
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

                  {/* 2. PRISTINE PRINT TYPOGRAPHY (Rendered exclusively during physical laser print) */}
                  <div className="print-only" style={{
                    display: 'none',
                    fontSize: '0.84rem',
                    color: 'var(--slate-900)',
                    padding: '2px 0'
                  }}>
                    <strong style={{ color: 'var(--slate-900)' }}>{med.dosagePattern}</strong>
                    <span style={{ margin: '0 8px', color: 'var(--slate-400)' }}>•</span>
                    <span style={{ color: 'var(--slate-700)' }}>{med.duration}</span>
                    <span style={{ margin: '0 8px', color: 'var(--slate-400)' }}>•</span>
                    <span className="font-bangla" style={{ fontWeight: '600', color: 'var(--teal-900)' }}>{med.instructionsBangla}</span>
                  </div>

                </div>
              ))}
            </div>

            {/* ADVICE IN BENGALI SECTION WITH MANUAL OVERRIDE */}
            <div style={{
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: '1px dashed var(--slate-200)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  color: 'var(--slate-800)',
                  textTransform: 'uppercase'
                }}>
                  পরামর্শ ও খাদ্যবিধি (Doctor's Advice):
                </span>
              </div>
              <ul className="font-bangla" style={{
                marginTop: '4px',
                paddingLeft: '16px',
                fontSize: '0.82rem',
                color: 'var(--slate-700)',
                lineHeight: 1.5
              }}>
                {advice.map((adv, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>{adv}</span>
                    {onDeleteAdvice && (
                      <button
                        type="button"
                        onClick={() => onDeleteAdvice(i)}
                        className="no-print"
                        style={{ border: 'none', background: 'transparent', color: 'var(--slate-400)', cursor: 'pointer', padding: '0 3px' }}
                        title="Remove advice line"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {/* Add Custom Advice (No-Print) */}
              {onAddAdvice && (
                <div className="no-print" style={{ display: 'flex', gap: '3px', marginTop: '4px' }}>
                  <input
                    type="text"
                    placeholder="পরামর্শ টাইপ করুন (e.g. চিনি খাওয়া বর্জন করুন)..."
                    value={customAdvice}
                    onChange={e => setCustomAdvice(e.target.value)}
                    className="input-clinical font-bangla"
                    style={{ padding: '3px 6px', fontSize: '0.74rem' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && customAdvice.trim()) {
                        e.preventDefault();
                        onAddAdvice(customAdvice.trim());
                        setCustomAdvice('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAdvice.trim()) {
                        onAddAdvice(customAdvice.trim());
                        setCustomAdvice('');
                      }
                    }}
                    className="btn-clinical btn-outline"
                    style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                  >
                    <Plus size={11} />
                  </button>
                </div>
              )}
            </div>

            {/* FOLLOW-UP & EMERGENCY RED FLAGS */}
            <div style={{
              marginTop: '12px',
              background: 'var(--slate-50)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--slate-200)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              pageBreakInside: 'avoid'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={12} color="var(--teal-600)" />
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--slate-800)' }}>
                    পরবর্তী সাক্ষাৎ (Follow-up):
                  </span>
                  <span className="font-bangla" style={{ fontSize: '0.78rem', color: 'var(--teal-800)', fontWeight: '700' }}>
                    {followUp}
                  </span>
                </div>

                {onUpdateFollowUp && (
                  <div className="no-print" style={{ display: 'flex', gap: '3px' }}>
                    {['৩ দিন পর', '৭ দিন পর', '১৪ দিন পর', '১ মাস পর'].map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => onUpdateFollowUp(`${f} রিপোর্টসহ দেখা করবেন`)}
                        style={{
                          fontSize: '0.64rem',
                          padding: '1px 5px',
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

              {/* Referral Note if exists */}
              {customReferral && (
                <div style={{ fontSize: '0.72rem', color: 'var(--sapphire-700)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <UserCheck size={11} />
                  <span><strong>Referred To:</strong> {customReferral}</span>
                </div>
              )}

              {/* Referral Input (No-Print) */}
              {onUpdateReferredTo && (
                <div className="no-print" style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                  <input
                    type="text"
                    placeholder="Refer to consultant / hospital (optional)..."
                    value={customReferral}
                    onChange={e => {
                      setCustomReferral(e.target.value);
                      onUpdateReferredTo(e.target.value);
                    }}
                    className="input-clinical"
                    style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                  />
                </div>
              )}

              {/* Emergency Red Flags warning */}
              <div style={{ fontSize: '0.7rem', color: 'var(--crimson-700)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                <AlertTriangle size={11} />
                <span className="font-bangla">{emergencyRedFlags}</span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* FOOTER OF PRESCRIPTION PAD (SIGNATURE & REGISTRATION) */}
      <div style={{
        marginTop: '16px',
        paddingTop: '10px',
        borderTop: '1px solid var(--slate-200)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        fontSize: '0.72rem',
        color: 'var(--slate-500)',
        pageBreakInside: 'avoid'
      }}>
        <div>
          <div style={{ color: 'var(--slate-700)', fontWeight: '600' }}>
            Generated by <strong>BanglaRx AI™</strong>
          </div>
          <div style={{ color: 'var(--slate-400)', fontSize: '0.68rem', marginTop: '1px' }}>
            Clinical Decision Support System • DGDA Standard
          </div>
        </div>

        <div style={{ textAlign: 'center', minWidth: '160px' }}>
          <div style={{
            fontFamily: 'serif',
            fontStyle: 'italic',
            fontSize: '0.95rem',
            color: 'var(--teal-800)',
            marginBottom: '2px'
          }}>
            {doctor?.name || 'Prof. Dr. M. A. Rahman'}
          </div>
          <div style={{ borderTop: '1px solid var(--slate-400)', paddingTop: '2px', fontSize: '0.7rem' }}>
            Registered Physician's Signature
          </div>
        </div>
      </div>

    </div>
  );
};
