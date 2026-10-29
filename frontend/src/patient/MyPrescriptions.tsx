import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Pill } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState } from '../design-system';
import { num, tr } from './i18n';
import type { Lang } from './i18n';
import { pcall } from './session';

interface Medicine {
  brandName: string;
  genericName: string;
  form: string;
  strength: string;
  dosagePattern: string;
  duration: string;
  instructionsBangla: string;
  sameIngredient: string[];
}
interface Rx {
  id: number;
  rxNumber: string;
  version: number;
  createdAt: string;
  doctorName: string;
  specialization: string;
  patientName: string;
  diagnosis?: string;
  adviceBangla: string[];
  followUp?: string;
  referredTo?: string;
  medicines: Medicine[];
}

/** "1+0+1" becomes "morning 1, night 1". Anything else is shown exactly as the doctor wrote it. */
export function readableDose(lang: Lang, pattern: string): string {
  const m = /^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$/.exec(pattern.replace(/\s/g, ''));
  if (!m) return pattern || '—';
  const parts: string[] = [];
  if (+m[1] > 0) parts.push(`${tr(lang, 'morning')} ${num(lang, m[1])}`);
  if (+m[2] > 0) parts.push(`${tr(lang, 'noon')} ${num(lang, m[2])}`);
  if (+m[3] > 0) parts.push(`${tr(lang, 'night')} ${num(lang, m[3])}`);
  return parts.length ? parts.join(', ') : pattern;
}

const dateOf = (lang: Lang, iso: string) => new Date(iso).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const MedicineCard: React.FC<{ lang: Lang; m: Medicine }> = ({ lang, m }) => {
  const [open, setOpen] = useState(false);
  return (
    <li className="rx-pt__booking" style={{ alignItems: 'flex-start' }}>
      <div className="rx-stack" style={{ gap: 6, flex: 1 }}>
        <strong>{m.brandName}</strong>
        <div className="rx-pt__meta">{[m.form, m.strength, m.genericName].filter(Boolean).join(' · ')}</div>
        <div><span className="rx-pt__meta">{tr(lang, 'howOften')}: </span><strong>{readableDose(lang, m.dosagePattern)}</strong></div>
        <div><span className="rx-pt__meta">{tr(lang, 'forDays')}: </span><strong>{m.duration || '—'}</strong></div>
        <div><span className="rx-pt__meta">{tr(lang, 'howToTake')}: </span><strong className="rx-bn">{m.instructionsBangla || '—'}</strong></div>
        {m.sameIngredient.length > 0 && (
          <>
            <Button variant="text" icon={open ? <ChevronUp size={16} /> : <ChevronDown size={16} />} onClick={() => setOpen(!open)} aria-expanded={open}>
              {tr(lang, 'sameIngredient')}
            </Button>
            {open && (
              <div className="rx-stack" style={{ gap: 6 }}>
                <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap' }}>{m.sameIngredient.map((b) => <Badge key={b}>{b}</Badge>)}</div>
                <span className="rx-pt__meta">{tr(lang, 'askBeforeChange')}</span>
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
};

/** What the doctor signed, in plain words, for everyone on this account. */
export const MyPrescriptions: React.FC<{ lang: Lang; onBack: () => void }> = ({ lang, onBack }) => {
  const [list, setList] = useState<Rx[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pcall<Rx[]>('GET', '/patient/prescriptions').then((r) => {
      if (r.ok) setList(r.data ?? []);
      else setError(r.errors.map((e) => (e === 'NETWORK' ? tr(lang, 'network') : e)).join(' '));
    });
  }, [lang]);

  return (
    <div className="rx-stack" style={{ gap: 20 }}>
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'myMeds')}</h1>
        <Button variant="text" onClick={onBack}>{tr(lang, 'back')}</Button>
      </div>
      {error && <Callout tone="danger">{error}</Callout>}
      {list === null && !error && <span>{tr(lang, 'loading')}</span>}
      {list !== null && list.length === 0 && <EmptyState icon={<FileText size={32} />} title={tr(lang, 'noRx')} />}
      {list?.map((rx, idx) => (
        <Card key={rx.id} active={idx === 0}>
          <div className="rx-stack" style={{ gap: 14 }}>
            <div>
              <strong>{rx.doctorName}</strong>
              <div className="rx-pt__meta">{rx.specialization} · {tr(lang, 'visitOn')} {dateOf(lang, rx.createdAt)}</div>
              <div className="rx-pt__meta">{rx.patientName} · {rx.rxNumber}{rx.version > 1 ? ` · v${num(lang, rx.version)}` : ''}</div>
            </div>
            {rx.diagnosis && <div><span className="rx-pt__meta">{tr(lang, 'diagnosisLbl')}: </span><strong>{rx.diagnosis}</strong></div>}
            {rx.adviceBangla.length > 0 && (
              <div className="rx-stack" style={{ gap: 4 }}>
                <strong>{tr(lang, 'doctorAdvice')}</strong>
                <ul className="rx-bn" style={{ margin: 0, paddingLeft: 20 }}>{rx.adviceBangla.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            {rx.medicines.length > 0 && (
              <div className="rx-stack" style={{ gap: 8 }}>
                <strong className="rx-row" style={{ gap: 6 }}><Pill size={16} aria-hidden="true" />{tr(lang, 'medicinesLbl')} ({num(lang, rx.medicines.length)})</strong>
                <ul className="rx-pt__list">{rx.medicines.map((m, i) => <MedicineCard key={i} lang={lang} m={m} />)}</ul>
              </div>
            )}
            {rx.followUp && <div><span className="rx-pt__meta">{tr(lang, 'followUpLbl')}: </span><strong className="rx-bn">{rx.followUp}</strong></div>}
            {rx.referredTo && <div><span className="rx-pt__meta">{tr(lang, 'referredLbl')}: </span><strong>{rx.referredTo}</strong></div>}
            <span className="rx-pt__meta">{tr(lang, 'rxNote')}</span>
          </div>
        </Card>
      ))}
    </div>
  );
};
