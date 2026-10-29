import React, { useEffect, useRef, useState } from 'react';
import { Plus, Send, Sparkles, X } from 'lucide-react';
import { API_BASE } from '../api';
import { Badge, Button, Callout, Chip, IconButton } from '../design-system';
import type { MedicineOption, Patient, PrescriptionItem, SafetyAlert } from '../types/index';

interface Card {
  key: string;
  generic: string;
  strength: string;
  form: string;
  dose: string;
  why: string;
  options: MedicineOption[];
}
interface Turn {
  id: number;
  role: 'user' | 'ai';
  text: string;
  cards?: Card[];
  alerts?: SafetyAlert[];
  notInFormulary?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  weightKg?: string;
  padItems: PrescriptionItem[];
  /** puts one formulary brand on the pad. Dosage and duration stay blank for the doctor to choose. */
  onAdd: (opt: MedicineOption) => void;
}

const QUICK = ['What dose is safe for this patient?', 'Check interactions with the pad', 'Which options avoid her allergies?'];

/** Rx সাথী: ask a clinical question about the patient on the screen. Suggestions come only from the formulary. */
export const SathiPanel: React.FC<Props> = ({ open, onClose, patient, weightKg, padItems, onAdd }) => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [large, setLarge] = useState(false);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // a new patient is a new conversation: nothing said about one patient carries over to another
  useEffect(() => {
    setTurns([]);
    setError('');
    setPicked({});
  }, [patient?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [turns.length, busy]);

  if (!open) return null;

  const onPad = (opt: MedicineOption) => padItems.some((m) => m.medicineId === opt.id);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    const mine: Turn = { id: nextId.current++, role: 'user', text: q };
    const history = [...turns, mine];
    setTurns(history);
    setText('');
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/sathi/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient?.id ?? null,
          weightKg: weightKg || null,
          messages: history.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', text: t.text })),
          padItems: padItems.map((m) => ({ brandName: m.brandName, genericName: m.genericName, form: m.form, strength: m.strength })),
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d) {
        setError(d?.errors?.join(' ') ?? "Can't reach the server.");
      } else {
        setTurns([...history, { id: nextId.current++, role: 'ai', text: d.reply, cards: d.cards, alerts: d.alerts, notInFormulary: d.notInFormulary }]);
      }
    } catch {
      setError("Can't reach the server.");
    }
    setBusy(false);
  };

  const fs = large ? 19 : 15;

  return (
    <aside
      aria-label="Rx Sathi"
      className="no-print"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100vw)', zIndex: 60, display: 'flex', flexDirection: 'column', background: 'var(--rx-surface)', borderLeft: '1px solid var(--rx-outline)', boxShadow: 'var(--rx-shadow-paper)' }}
    >
      <header className="rx-row" style={{ justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--rx-outline)' }}>
        <div className="rx-stack" style={{ gap: 0 }}>
          <strong className="rx-bn" style={{ fontSize: 18 }}>Rx সাথী</strong>
          <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Answers in Bangla or English</span>
        </div>
        <div className="rx-row" style={{ gap: 4 }}>
          <Button variant="text" onClick={() => setLarge(!large)} aria-pressed={large} title="Larger text">A+</Button>
          <IconButton aria-label="Close Rx Sathi" onClick={onClose}><X size={20} /></IconButton>
        </div>
      </header>

      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--rx-outline)', background: 'var(--rx-surface-2)' }}>
        {patient ? (
          <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Sathi is reading</span>
            <Badge tone="primary">{patient.full_name} · {patient.age} {patient.gender?.[0]}</Badge>
            <Badge>{weightKg ? `${weightKg} kg` : 'Weight not recorded'}</Badge>
            {patient.allergies && !/^(none|not recorded|none reported)$/i.test(patient.allergies.trim()) ? <Badge tone="danger">{patient.allergies} allergy</Badge> : <Badge>Allergies not recorded</Badge>}
          </div>
        ) : (
          <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>No patient selected. Answers will not use a chart.</span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: fs }} aria-live="polite">
        {turns.length === 0 && (
          <div className="rx-stack" style={{ gap: 10 }}>
            <span style={{ color: 'var(--rx-ink-2)' }}>Ask about doses, interactions or options for this patient. You decide what goes on the pad.</span>
            <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap' }}>{QUICK.map((q) => <Chip key={q} onClick={() => send(q)}>{q}</Chip>)}</div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} style={{ alignSelf: t.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="rx-bn" style={{ padding: '10px 14px', borderRadius: 16, lineHeight: 1.55, background: t.role === 'user' ? 'var(--rx-primary-container)' : 'var(--rx-surface-2)', color: t.role === 'user' ? 'var(--rx-on-primary-container)' : 'var(--rx-ink)' }}>
              {t.text}
            </div>
            {t.alerts?.map((a, i) => (
              <Callout key={i} tone={a.severity === 'critical' || a.severity === 'major' ? 'danger' : 'attention'} title={a.title}>{a.detail}</Callout>
            ))}
            {t.cards?.map((c) => {
              const idx = picked[`${t.id}-${c.key}`] ?? 0;
              const opt = c.options[idx] ?? c.options[0];
              const on = onPad(opt);
              return (
                <div key={c.key} className="rx-stack" style={{ gap: 6, padding: 12, border: '1px solid var(--rx-outline)', borderRadius: 14, background: 'var(--rx-surface)' }}>
                  <strong>{c.generic} {c.strength} <span style={{ fontWeight: 400, color: 'var(--rx-ink-2)' }}>{c.form}</span></strong>
                  {c.dose && <span>Suggested: {c.dose}</span>}
                  {c.why && <span style={{ color: 'var(--rx-ink-2)' }}>{c.why}</span>}
                  <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {c.options.map((o, i) => (
                      <Chip key={o.id} selected={i === idx} onClick={() => setPicked({ ...picked, [`${t.id}-${c.key}`]: i })}>{o.brandName}</Chip>
                    ))}
                  </div>
                  <Button variant={on ? 'tonal' : 'outlined'} icon={<Plus size={16} />} disabled={on} onClick={() => onAdd(opt)}>
                    {on ? 'On the Rx pad' : `Add ${opt.brandName} to the Rx pad`}
                  </Button>
                </div>
              );
            })}
            {t.notInFormulary && t.notInFormulary.length > 0 && (
              <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Not in our formulary, so no card: {t.notInFormulary.join(', ')}</span>
            )}
          </div>
        ))}
        {busy && <span style={{ color: 'var(--rx-ink-2)' }}><Sparkles size={14} aria-hidden="true" /> checking the chart…</span>}
        {error && <Callout tone="danger">{error}</Callout>}
        <div ref={endRef} />
      </div>

      <form
        style={{ padding: 12, borderTop: '1px solid var(--rx-outline)', display: 'flex', gap: 8, alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="sathi-input" className="rx-visually-hidden">Message Rx Sathi</label>
        <input id="sathi-input" className="rx-field__input" style={{ flex: 1 }} placeholder="Message Rx Sathi" value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" icon={<Send size={18} />} disabled={busy || !text.trim()}>Send</Button>
      </form>
      <p style={{ margin: 0, padding: '0 16px 10px', fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Sathi can make mistakes. Verify doses and interactions before you prescribe.</p>
    </aside>
  );
};
