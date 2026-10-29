import React, { useEffect, useState } from 'react';
import { Mic, Phone, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Button, Callout, Card } from '../design-system';
import { fmtDate, tr } from './i18n';
import type { Lang } from './i18n';
import { pcall } from './session';

/** The emergency screen: no booking talk, one big call button. Shown from the home screen, and by Rubina when a red flag is typed. */
export const EmergencyCard: React.FC<{ lang: Lang; onBack?: () => void }> = ({ lang, onBack }) => (
  <div className="rx-stack" style={{ gap: 18 }}>
    {onBack && (
      <div className="rx-row" style={{ justifyContent: 'flex-end' }}>
        <Button variant="text" onClick={onBack}>{tr(lang, 'back')}</Button>
      </div>
    )}
    <Callout tone="danger" icon={<TriangleAlert size={28} />} title={tr(lang, 'emergencyTitle')}>
      <span className="rx-bn">{tr(lang, 'emergencyLead')}</span>
    </Callout>
    <a
      href="tel:999"
      className="rx-btn rx-btn--lg rx-btn--filled"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 72, borderRadius: 36, background: 'var(--rx-danger-solid)', color: 'var(--rx-on-danger)', fontWeight: 700, fontSize: 22, textDecoration: 'none' }}
    >
      <Phone size={28} aria-hidden="true" />
      {tr(lang, 'call999')}
    </a>
    <Card>
      <div className="rx-stack" style={{ gap: 8 }}>
        <strong className="rx-bn">{tr(lang, 'emergencySteps')}</strong>
        <ul className="rx-bn" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
          <li>{tr(lang, 'emergencyStep1')}</li>
          <li>{tr(lang, 'emergencyStep2')}</li>
          <li>{tr(lang, 'emergencyStep3')}</li>
        </ul>
      </div>
    </Card>
    <span className="rx-pt__meta">{tr(lang, 'notADiagnosis')}</span>
  </div>
);

export const Emergency = EmergencyCard;

interface Consent {
  recordVisit: boolean | null;
  reminders: boolean;
  storeReports: boolean;
  updatedAt?: string;
}

const Switch: React.FC<{ label: string; help: string; on: boolean; onChange: (v: boolean) => void }> = ({ label, help, on, onChange }) => (
  <Card>
    <div className="rx-row" style={{ justifyContent: 'space-between', gap: 12 }}>
      <div className="rx-stack" style={{ gap: 2 }}>
        <strong className="rx-bn">{label}</strong>
        <span className="rx-pt__meta">{help}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        style={{ all: 'unset', cursor: 'pointer', flex: 'none', width: 56, height: 36, borderRadius: 18, position: 'relative', background: on ? 'var(--rx-primary)' : 'var(--rx-ink-3)' }}
      >
        <span style={{ position: 'absolute', top: 4, left: on ? 24 : 4, width: 28, height: 28, borderRadius: '50%', background: 'var(--rx-on-primary)', transition: 'left .15s' }} />
      </button>
    </div>
  </Card>
);

/** What the patient allows. The recording answer is saved with its date; the doctor's screen follows it. */
export const ConsentScreen: React.FC<{ lang: Lang; onBack: () => void }> = ({ lang, onBack }) => {
  const [c, setC] = useState<Consent>({ recordVisit: null, reminders: false, storeReports: false });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    pcall<Consent>('GET', '/patient/consent').then((r) => {
      if (r.ok && r.data) setC(r.data);
      setLoaded(true);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    const r = await pcall<Consent>('POST', '/patient/consent', c);
    setBusy(false);
    if (r.ok && r.data) {
      setC(r.data);
      setMsg({ tone: 'success', text: tr(lang, 'consentSaved') });
    } else setMsg({ tone: 'danger', text: r.errors.map((e) => (e === 'NETWORK' ? tr(lang, 'network') : e)).join(' ') });
  };

  const choose = (v: boolean) => {
    setMsg(null);
    setC({ ...c, recordVisit: v });
  };

  return (
    <div className="rx-stack" style={{ gap: 18 }}>
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'consentTitle')}</h1>
        <Button variant="text" onClick={onBack}>{tr(lang, 'back')}</Button>
      </div>
      {!loaded ? <span>{tr(lang, 'loading')}</span> : (
        <>
          <p className="rx-pt__lead rx-bn">{tr(lang, 'consentLead')}</p>
          <Card>
            <div className="rx-stack" style={{ gap: 12 }}>
              <div className="rx-row" style={{ gap: 10 }}>
                <Mic size={22} aria-hidden="true" />
                <div className="rx-stack" style={{ gap: 2 }}>
                  <strong className="rx-bn">{tr(lang, 'recordVisit')}</strong>
                  <span className="rx-pt__meta">{tr(lang, 'recordVisitHelp')}</span>
                </div>
              </div>
              <div className="rx-row" style={{ gap: 10 }}>
                <Button variant={c.recordVisit === true ? 'filled' : 'outlined'} onClick={() => choose(true)} aria-pressed={c.recordVisit === true} fullWidth>{tr(lang, 'yesRecord')}</Button>
                <Button variant={c.recordVisit === false ? 'filled' : 'outlined'} onClick={() => choose(false)} aria-pressed={c.recordVisit === false} fullWidth>{tr(lang, 'noRecord')}</Button>
              </div>
              {c.recordVisit === false && <Callout tone="attention">{tr(lang, 'noRecordNote')}</Callout>}
            </div>
          </Card>
          <Switch label={tr(lang, 'remindersLbl')} help={tr(lang, 'remindersHelp')} on={c.reminders} onChange={(v) => { setMsg(null); setC({ ...c, reminders: v }); }} />
          <Switch label={tr(lang, 'storeReportsLbl')} help={tr(lang, 'storeReportsHelp')} on={c.storeReports} onChange={(v) => { setMsg(null); setC({ ...c, storeReports: v }); }} />
          <span className="rx-pt__meta">
            <ShieldCheck size={14} aria-hidden="true" /> {tr(lang, 'consentFoot')}
            {c.updatedAt ? ` ${tr(lang, 'lastSaved')}: ${fmtDate(lang, c.updatedAt.slice(0, 10))}.` : ''}
          </span>
          {msg && <Callout tone={msg.tone}>{msg.text}</Callout>}
          <Button size="lg" onClick={save} disabled={busy || c.recordVisit === null} fullWidth>
            {c.recordVisit === null ? tr(lang, 'answerFirst') : tr(lang, 'saveChoices')}
          </Button>
        </>
      )}
    </div>
  );
};
