import React, { useId, useState } from 'react';
import { Volume2, Printer, QrCode, Plus, X, Calendar, FileText, Edit2, Check, UserCheck, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { Doctor, Patient, PrescriptionItem, GeneralSigns, SafetyAlert, MedicineOption } from '../types/index';
import { useSession } from '../auth/session';
import { Badge, Button, Callout, Chip, IconButton, MedicineRow, PatientBanner, Textarea, VitalRow } from '../design-system';
import { RxHistoryModal } from './RxHistoryModal';

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
  safetyAlerts: SafetyAlert[];
  onDeleteMedicine: (index: number) => void;
  onChooseMedicine?: (index: number, option: MedicineOption) => void;
  templates?: { id: number; name: string }[];
  onApplyTemplate?: (id: number) => void;
  onSaveTemplate?: () => void;
  onRepeatLast?: () => void;
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
  generalSigns: GeneralSigns;
  onUpdateGeneralSigns: (key: keyof GeneralSigns, val: string) => void;
  examNotes: string;
  onUpdateExamNotes: (val: string) => void;
  rxVersion?: number;
  isSavedRx?: boolean;
  /** database id of the saved prescription, for the history list */
  rxId?: number | null;
  onSpeakBangla: (text: string) => void;
  onOpenQrModal: () => void;
  /** signs and saves the prescription (new version when it was already saved) */
  onSign: () => void;
  isSigning: boolean;
  signSuccess: boolean;
  /** the medicine search row, placed under the list of medicines */
  searchSlot?: React.ReactNode;
}

const COMMON_DOSAGES = ['1+0+1', '1+1+1', '1+0+0', '0+0+1', '৪ ঘণ্টা পর পর', '৬ ঘণ্টা পর পর', '৮ ঘণ্টা পর পর', 'জর আসলে ১টি (SOS)'];
const COMMON_DURATIONS = ['৩ দিন', '৫ দিন', '৭ দিন', '১৪ দিন', '১ মাস', 'চলবে (Continue)'];
const COMMON_INSTRUCTIONS = ['ভরা পেটে খাবেন', 'খাওয়ার ২০ মিনিট আগে', 'খাওয়ার মাঝে', 'খালি পেটে', 'জর ১০১° এর বেশি হলে'];
const COMMON_INVESTIGATIONS = ['CBC with ESR', 'Dengue NS1 Antigen', 'Serum Creatinine', 'HbA1c', 'SGPT (ALT)', 'USG of Whole Abdomen', 'Chest X-Ray', 'Urine R/E'];
const FOLLOW_UPS = ['৩ দিন পর', '৭ দিন পর', '১৪ দিন পর', '১ মাস পর'];
const ALERT_LABEL: Record<string, string> = { allergy: 'ALLERGY', duplicate: 'DUPLICATE', interaction: 'INTERACTION', dose: 'DOSE' };

/** [field, label, options, values that count as normal] for the general examination */
const GENERAL_EXAM: Array<{ key: keyof GeneralSigns; label: string; options: Array<[string, string]>; normal: string }> = [
  { key: 'anaemia', label: 'Anaemia', normal: 'Nil', options: [['Nil', 'Nil'], ['Mild (+)', 'Mild (+)'], ['Moderate (++)', 'Mod (++)'], ['Severe (+++)', 'Sev (+++)']] },
  { key: 'jaundice', label: 'Jaundice', normal: 'Absent', options: [['Absent', 'Absent'], ['Mild (+)', 'Mild (+)'], ['Deep (++)', 'Deep (++)']] },
  { key: 'oedema', label: 'Oedema', normal: 'Nil', options: [['Nil', 'Nil'], ['Mild (+)', 'Mild (+)'], ['Pitting (++)', 'Pitting (++)']] },
  { key: 'cyanosis', label: 'Cyanosis', normal: 'Absent', options: [['Absent', 'Absent'], ['Present (+)', 'Present (+)']] },
  { key: 'dehydration', label: 'Dehydration', normal: 'None', options: [['None', 'None'], ['Some (+)', 'Some (+)'], ['Severe (++)', 'Sev (++)']] },
  { key: 'lymphNodes', label: 'Lymph node', normal: 'Not palpable', options: [['Not palpable', 'Not palpable'], ['Cervical (+)', 'Cervical (+)'], ['Enlarged (+)', 'Enlarged (+)']] },
];

/** A one-line "type and press Enter" row used for symptoms, tests and advice. Screen only. */
function AddRow({ label, placeholder, value, onChange, onAdd, bangla }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; onAdd: (v: string) => void; bangla?: boolean;
}) {
  const id = useId();
  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      onChange('');
    }
  };
  return (
    <div className="rx-pad__row no-print">
      <div className="rx-field__control">
        <label htmlFor={id} className="rx-visually-hidden">{label}</label>
        <input
          id={id}
          className={'rx-field__input' + (bangla ? ' rx-bn' : '')}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <IconButton aria-label={`Add ${label}`} variant="tonal" onClick={submit}>
        <Plus size={18} />
      </IconButton>
    </div>
  );
}

/** A list line with a remove button (the button never prints). */
function Line({ children, onRemove, label }: { children: React.ReactNode; onRemove?: () => void; label: string }) {
  return (
    <li className="rx-pad__item">
      <span>{children}</span>
      {onRemove && (
        <IconButton aria-label={`Remove ${label}`} className="no-print" onClick={onRemove}>
          <X size={16} />
        </IconButton>
      )}
    </li>
  );
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
  patientReportsPresented = [],
  advice,
  followUp = '',
  emergencyRedFlags = '',
  referredTo = '',
  safetyAlerts,
  onDeleteMedicine,
  onChooseMedicine,
  templates = [],
  onApplyTemplate,
  onSaveTemplate,
  onRepeatLast,
  onUpdateMedicine,
  onAddInvestigation,
  onDeleteInvestigation,
  onAddComplaint,
  onDeleteComplaint,
  onUpdateDiagnosis,
  onAddAdvice,
  onDeleteAdvice,
  onUpdateFollowUp,
  onUpdateReferredTo,
  generalSigns,
  onUpdateGeneralSigns,
  examNotes,
  onUpdateExamNotes,
  rxVersion = 1,
  isSavedRx = false,
  rxId = null,
  onSpeakBangla,
  onOpenQrModal,
  onSign,
  isSigning,
  signSuccess,
  searchSlot,
}) => {
  // when signed in, only a doctor may sign; with sign-in switched off nobody is signed in and nothing changes
  const session = useSession();
  const canSign = !session || session.user.role === 'doctor';
  const [customTest, setCustomTest] = useState('');
  const [customComplaint, setCustomComplaint] = useState('');
  const [customAdvice, setCustomAdvice] = useState('');
  const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
  const [tempDiagnosis, setTempDiagnosis] = useState(diagnosis);
  const [isEditingExamNotes, setIsEditingExamNotes] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const tempHot = vitals.temp ? parseFloat(vitals.temp) >= 100 : false;

  const readAloud = () => {
    const speech = medicines.map((m, idx) => `${idx + 1}. ${m.brandName}, ${m.dosagePattern}, ${m.instructionsBangla}`).join('। ');
    onSpeakBangla(`ঔষধ সেবনের নির্দেশিকা: ${speech}`);
  };

  return (
    <article className="rx-pad rx-paper" aria-label="Prescription pad">
      {/* ---- Letterhead ---- */}
      <header className="rx-pad__head">
        <div className="rx-pad__doctor">
          <h2>{doctor?.name || '—'}</h2>
          <span className="rx-pad__degrees">{doctor?.degrees || ''}</span>
          <span className="rx-pad__small">{doctor?.specialization || ''}</span>
          <span className="rx-pad__small">
            BMDC Reg. {doctor?.bmdc_reg_no || '—'} · {doctor?.hospital_name || ''} · Room {doctor?.room_no || '—'}
          </span>
        </div>
        <div className="rx-pad__meta">
          <strong className="rx-pad__official">OFFICIAL E-PRESCRIPTION</strong>
          <span>
            Rx ID <span className="rx-pad__mono">{savedRxNumber || 'Draft (not saved)'}</span>
            {isSavedRx && rxVersion > 1 ? ` · v${rxVersion}` : ''}
          </span>
          {isSavedRx && rxId ? (
            <Button variant="text" className="no-print" onClick={() => setHistoryOpen(true)}>History</Button>
          ) : null}
          <span>{new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </header>

      <PatientBanner
        name={patient?.full_name}
        ageSex={patient ? `${patient.age}Y / ${patient.gender}` : undefined}
        bloodGroup={patient?.blood_group}
        allergies={patient?.allergies}
        phone={patient?.phone}
      />

      {/* ---- Safety: allergy, duplicate, interaction, dose (screen only, never printed) ---- */}
      {safetyAlerts.length > 0 && (
        <div className="rx-stack no-print" style={{ gap: 8 }}>
          {safetyAlerts.map((a, i) => {
            const critical = a.severity === 'critical' || a.severity === 'major';
            return (
              <Callout key={i} tone={critical ? 'danger' : 'attention'} title={a.title}>
                {(ALERT_LABEL[a.type] || a.type.toUpperCase())} · {a.severity.toUpperCase()}. {a.detail}
              </Callout>
            );
          })}
        </div>
      )}

      <div className="rx-pad__cols">
        {/* ================= Findings ================= */}
        <div className="rx-pad__findings">
          <section className="rx-pad__sec">
            <h3 className="rx-pad__h">Vitals</h3>
            <VitalRow label="BP" value={vitals.bp} />
            <VitalRow label="Temp" value={vitals.temp} hot={tempHot} />
            <VitalRow label="Pulse" value={vitals.pulse} />
            <VitalRow label="SpO₂" value={vitals.spo2} />
            <VitalRow label="Height" value={vitals.height} />
            <VitalRow label="Weight" value={vitals.weight} />
          </section>

          <section className={'rx-pad__sec' + (complaints.length === 0 ? ' rx-pad__nop' : '')}>
            <h3 className="rx-pad__h">Complaints</h3>
            {complaints.length === 0 && <p className="rx-pad__hint no-print">Nothing yet. The AI fills this only from what it hears.</p>}
            <ul className="rx-pad__list">
              {complaints.map((c, i) => (
                <Line key={i} label={c} onRemove={onDeleteComplaint ? () => onDeleteComplaint(i) : undefined}>
                  {c}
                </Line>
              ))}
            </ul>
            {onAddComplaint && <AddRow label="symptom" placeholder="Add a symptom" value={customComplaint} onChange={setCustomComplaint} onAdd={onAddComplaint} />}
          </section>

          <section className="rx-pad__sec">
            <h3 className="rx-pad__h">
              <span>Diagnosis</span>
              {onUpdateDiagnosis && (
                <Button
                  variant="text"
                  className="no-print"
                  icon={isEditingDiagnosis ? <Check size={14} /> : <Edit2 size={14} />}
                  onClick={() => {
                    if (isEditingDiagnosis && tempDiagnosis.trim()) onUpdateDiagnosis(tempDiagnosis.trim());
                    else if (!isEditingDiagnosis) setTempDiagnosis(diagnosis);
                    setIsEditingDiagnosis(!isEditingDiagnosis);
                  }}
                >
                  {isEditingDiagnosis ? 'Save' : 'Edit'}
                </Button>
              )}
            </h3>
            {isEditingDiagnosis ? (
              <div className="rx-field__control no-print">
                <label htmlFor="pad-diagnosis" className="rx-visually-hidden">Clinical diagnosis</label>
                <input
                  id="pad-diagnosis"
                  className="rx-field__input"
                  type="text"
                  value={tempDiagnosis}
                  autoFocus
                  onChange={(e) => setTempDiagnosis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdateDiagnosis?.(tempDiagnosis);
                      setIsEditingDiagnosis(false);
                    }
                  }}
                />
              </div>
            ) : diagnosis ? (
              <div className="rx-pad__dx">{diagnosis}</div>
            ) : (
              <p className="rx-pad__hint">Not stated yet</p>
            )}
          </section>

          <section className={'rx-pad__sec' + (Object.values(generalSigns).every((v) => !v) ? ' rx-pad__nop' : '')}>
            <h3 className="rx-pad__h">General exam</h3>
            <div className="rx-pad__grid2">
              {GENERAL_EXAM.map((g) => {
                const value = generalSigns[g.key] ?? '';
                const abnormal = value && value !== g.normal;
                return (
                  <label key={g.key} className="rx-pad__sign-lbl">
                    {g.label}
                    <select
                      className="rx-select rx-select--sm"
                      value={value}
                      onChange={(e) => onUpdateGeneralSigns(g.key, e.target.value)}
                      style={abnormal ? { color: 'var(--rx-danger-solid)' } : undefined}
                    >
                      <option value="">—</option>
                      {g.options.map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </div>
          </section>

          <section className={'rx-pad__sec' + (!examNotes ? ' rx-pad__nop' : '')}>
            <h3 className="rx-pad__h">
              <span>On examination (O/E)</span>
              <Button variant="text" className="no-print" onClick={() => setIsEditingExamNotes(!isEditingExamNotes)}>
                {isEditingExamNotes ? 'Done' : '+ Add O/E'}
              </Button>
            </h3>
            {isEditingExamNotes ? (
              <div className="no-print">
                <Textarea
                  label="On examination notes"
                  hideLabel
                  rows={3}
                  value={examNotes}
                  onChange={(e) => onUpdateExamNotes(e.target.value)}
                  placeholder="e.g. Chest: clear, breath sounds vesicular. Heart: S1+S2 audible. Abdomen: soft, non-tender."
                />
              </div>
            ) : (
              examNotes && <div className="rx-pad__note">{examNotes}</div>
            )}
          </section>

          {patientReportsPresented.length > 0 && (
            <section className="rx-pad__sec">
              <h3 className="rx-pad__h">
                <span>Reports reviewed today</span>
                <FileText size={14} aria-hidden="true" />
              </h3>
              <ul className="rx-pad__list">
                {patientReportsPresented.map((rep, idx) => (
                  <Line key={idx} label={rep}><strong>{rep}</strong></Line>
                ))}
              </ul>
            </section>
          )}

          <section className={'rx-pad__sec' + (investigations.length === 0 ? ' rx-pad__nop' : '')}>
            <h3 className="rx-pad__h">Advised tests ({investigations.length})</h3>
            <ul className="rx-pad__list">
              {investigations.map((inv, i) => (
                <Line key={i} label={inv} onRemove={() => onDeleteInvestigation(i)}>{inv}</Line>
              ))}
            </ul>
            <div className="rx-row no-print" style={{ gap: 6 }}>
              {COMMON_INVESTIGATIONS.slice(0, 5).map((test) => (
                <Chip key={test} onClick={() => onAddInvestigation(test)}>+ {test}</Chip>
              ))}
            </div>
            <AddRow label="test" placeholder="Custom test name" value={customTest} onChange={setCustomTest} onAdd={onAddInvestigation} />
          </section>
        </div>

        {/* ================= Rx ================= */}
        <div className="rx-pad__rx">
          <div className="rx-pad__rxmark">
            <div className="rx-row" style={{ gap: 10, alignItems: 'baseline' }}>
              <span className="rx-pad__rxsym">℞</span>
              <span className="rx-pad__small">Every line can be changed or removed · {medicines.length} medicine{medicines.length === 1 ? '' : 's'}</span>
            </div>
            <Button variant="text" className="no-print" icon={<Volume2 size={16} />} onClick={readAloud} title="Read the prescription aloud in Bangla">
              <span className="rx-bn">অডিও শুনুন</span>
            </Button>
          </div>

          <div className="rx-pad__tools no-print">
            {onRepeatLast && (
              <Button variant="outlined" onClick={onRepeatLast} title="Copy medicines, diagnosis, tests and advice from this patient's last prescription">
                Repeat last Rx
              </Button>
            )}
            {onApplyTemplate && templates.length > 0 && (
              <select
                aria-label="Apply a template"
                className="rx-select rx-select--sm"
                style={{ width: 'auto', minWidth: 180 }}
                value=""
                onChange={(e) => {
                  if (e.target.value) onApplyTemplate(Number(e.target.value));
                }}
              >
                <option value="">Apply template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            {onSaveTemplate && medicines.length > 0 && (
              <Button variant="outlined" onClick={onSaveTemplate}>Save as template</Button>
            )}
          </div>

          {medicines.length === 0 && (
            <div className="rx-pad__empty no-print">
              No medicines yet.<br />Press the mic and talk, or search below to add one by hand.
            </div>
          )}

          <div className="rx-pad__meds">
            {medicines.map((med, index) => {
              const unclear = med.matchStatus && med.matchStatus !== 'exact';
              return (
                <MedicineRow
                  key={index}
                  index={index + 1}
                  brand={med.brandName}
                  generic={`${med.form} · ${med.strength} · ${med.genericName}`}
                  dosage={med.dosagePattern || '—'}
                  duration={med.duration || '—'}
                  note={med.instructionsBangla}
                  onRemove={() => onDeleteMedicine(index)}
                  notice={
                    unclear ? (
                      <>
                        <strong>
                          {med.matchStatus === 'ambiguous' && 'Which one?'}
                          {med.matchStatus === 'fuzzy' && 'Did you mean?'}
                          {med.matchStatus === 'strength_unavailable' && 'That strength is not in the formulary. Available:'}
                          {med.matchStatus === 'unmatched' && 'Not found in the formulary. Kept as heard, please verify the name.'}
                        </strong>
                        {(med.matchOptions || []).map((opt) => (
                          <Button key={opt.id} variant="outlined" onClick={() => onChooseMedicine && onChooseMedicine(index, opt)}>
                            {opt.brandName} · {opt.form} {opt.strength}
                          </Button>
                        ))}
                      </>
                    ) : undefined
                  }
                  controls={
                    <div className="rx-pad__ctl">
                      <label>
                        Dosage pattern
                        <select className="rx-select rx-select--sm" value={med.dosagePattern} onChange={(e) => onUpdateMedicine(index, 'dosagePattern', e.target.value)}>
                          {COMMON_DOSAGES.map((d) => <option key={d} value={d}>{d}</option>)}
                          {!COMMON_DOSAGES.includes(med.dosagePattern) && <option value={med.dosagePattern}>{med.dosagePattern || '— choose —'}</option>}
                        </select>
                      </label>
                      <label>
                        Duration
                        <select className="rx-select rx-select--sm" value={med.duration} onChange={(e) => onUpdateMedicine(index, 'duration', e.target.value)}>
                          {COMMON_DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          {!COMMON_DURATIONS.includes(med.duration) && <option value={med.duration}>{med.duration || '— choose —'}</option>}
                        </select>
                      </label>
                      <label>
                        নির্দেশিকা (timing)
                        <select className="rx-select rx-select--sm rx-bn" value={med.instructionsBangla} onChange={(e) => onUpdateMedicine(index, 'instructionsBangla', e.target.value)}>
                          {COMMON_INSTRUCTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                          {!COMMON_INSTRUCTIONS.includes(med.instructionsBangla) && <option value={med.instructionsBangla}>{med.instructionsBangla || '— choose —'}</option>}
                        </select>
                      </label>
                    </div>
                  }
                />
              );
            })}
          </div>

          {searchSlot}

          <section className={'rx-pad__sec' + (advice.length === 0 ? ' rx-pad__nop' : '')}>
            <h3 className="rx-pad__h">উপদেশ ও খাদ্যবিধি · Advice</h3>
            {advice.length === 0 && <p className="rx-pad__hint no-print">No advice recorded yet</p>}
            <ul className="rx-pad__list rx-bn">
              {advice.map((adv, i) => (
                <Line key={i} label="advice line" onRemove={onDeleteAdvice ? () => onDeleteAdvice(i) : undefined}>{adv}</Line>
              ))}
            </ul>
            {onAddAdvice && <AddRow label="advice" bangla placeholder="পরামর্শ টাইপ করুন (e.g. চিনি খাওয়া বর্জন করুন)" value={customAdvice} onChange={setCustomAdvice} onAdd={onAddAdvice} />}
          </section>

          <section className="rx-pad__follow">
            <div className="rx-row" style={{ gap: 8 }}>
              <Calendar size={16} aria-hidden="true" />
              <strong>পরবর্তী সাক্ষাৎ · Follow-up:</strong>
              <span className="rx-bn" style={{ fontWeight: 700 }}>{followUp || '—'}</span>
            </div>
            {onUpdateFollowUp && (
              <div className="rx-row no-print" style={{ gap: 6 }}>
                {FOLLOW_UPS.map((f) => (
                  <Chip key={f} onClick={() => onUpdateFollowUp(`${f} রিপোর্টসহ দেখা করবেন`)}>{f}</Chip>
                ))}
              </div>
            )}
            {referredTo && (
              <div className="rx-row" style={{ gap: 6 }}>
                <UserCheck size={16} aria-hidden="true" />
                <span><strong>Referred to:</strong> {referredTo}</span>
              </div>
            )}
            {onUpdateReferredTo && (
              <div className="rx-field__control no-print">
                <label htmlFor="pad-referral" className="rx-visually-hidden">Refer to consultant or hospital</label>
                <input
                  id="pad-referral"
                  className="rx-field__input"
                  type="text"
                  placeholder="Refer to a consultant or hospital (optional)"
                  value={referredTo}
                  onChange={(e) => onUpdateReferredTo(e.target.value)}
                />
              </div>
            )}
            {emergencyRedFlags && (
              <Callout tone="danger" icon={<AlertTriangle size={20} />} title="Return urgently if">
                <span className="rx-bn">{emergencyRedFlags}</span>
              </Callout>
            )}
          </section>
        </div>
      </div>

      {/* ---- Footer: actions, then the signature ---- */}
      <footer className="rx-pad__foot">
        <div className="rx-pad__actions no-print">
          <Button variant="outlined" icon={<Printer size={18} />} onClick={() => window.print()} title="Print the prescription on A4">
            Print A4
          </Button>
          <Button variant="outlined" icon={<QrCode size={18} />} onClick={onOpenQrModal} title="Open the patient mobile view and QR code">
            Patient QR
          </Button>
          {!canSign ? (
            <Badge tone="info">Only the doctor signs</Badge>
          ) : signSuccess ? (
            <Badge tone="success" icon={<CheckCircle2 size={16} />}>Signed and sent</Badge>
          ) : (
            <Button size="lg" icon={<ShieldCheck size={20} />} onClick={onSign} disabled={isSigning}>
              {isSigning ? 'Checking…' : isSavedRx ? 'Sign new version' : 'Sign and save Rx'}
            </Button>
          )}
        </div>
        <div className="rx-pad__small" style={{ flex: '1 1 160px' }}>
          Generated by BanglaRx AI · DGDA standard
        </div>
        <div className="rx-pad__sig">
          <strong>{doctor?.name || '—'}</strong>
          <span>Registered physician's signature</span>
        </div>
      </footer>
      <RxHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} rxId={rxId} />
    </article>
  );
};
