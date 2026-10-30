import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState, Select, TextField } from '../design-system';
import { fmtDate, num, tr } from './i18n';
import type { Lang } from './i18n';
import { pcall, usePatientSession } from './session';

interface Value {
  name: string;
  value: string;
  unit: string;
  confidence?: 'clear' | 'unclear';
}
interface Draft {
  kind: string;
  takenOn: string | null;
  values: Value[];
}
interface Saved {
  id: number;
  profileId: number;
  patientName: string;
  kind: string;
  takenOn: string | null;
  createdAt: string;
  values: Value[];
}

/** Shrinks a phone photo before it is sent: a lab report is readable at 1600 px, and it is a fraction of the data. */
async function shrink(file: File): Promise<{ mime: string; base64: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.85);
  return { mime: 'image/jpeg', base64: url.slice(url.indexOf(',') + 1) };
}

const numeric = (v: string) => (/^-?\d+(\.\d+)?$/.test(v.trim()) ? parseFloat(v) : null);

/** A small line for one test over time. Drawn only from values the patient confirmed, and with no "good or bad" colour. */
const Trend: React.FC<{ lang: Lang; name: string; unit: string; points: Array<{ date: string; v: number }> }> = ({ lang, name, unit, points }) => {
  const w = 300;
  const h = 90;
  const lo = Math.min(...points.map((p) => p.v));
  const hi = Math.max(...points.map((p) => p.v));
  const span = hi - lo || 1;
  const xy = points.map((p, i) => [20 + (i * (w - 40)) / Math.max(1, points.length - 1), 20 + (1 - (p.v - lo) / span) * (h - 40)] as const);
  return (
    <div className="rx-stack" style={{ gap: 4 }}>
      <strong>{name}{unit ? ` (${unit})` : ''}</strong>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`${name}: ${points.map((p) => p.v).join(', ')}`} style={{ display: 'block' }}>
        <polyline points={xy.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--rx-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {xy.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="5" fill="var(--rx-primary)" />
            <text x={p[0]} y={p[1] - 9} fontSize="12" textAnchor="middle" fill="var(--rx-ink)">{num(lang, points[i].v)}</text>
          </g>
        ))}
      </svg>
      <div className="rx-row" style={{ justifyContent: 'space-between', fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
        {points.map((p, i) => <span key={i}>{fmtDate(lang, p.date)}</span>)}
      </div>
    </div>
  );
};

/** Photograph a report, check what the AI read, then keep it. The doctor sees it as "patient-given, AI-read". */
export const MyReports: React.FC<{ lang: Lang; onBack: () => void; onConsent: () => void }> = ({ lang, onBack, onConsent }) => {
  const session = usePatientSession()!;
  const [who, setWho] = useState<number>(session.profiles[0]?.id ?? 0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'attention'; text: string; consent?: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await pcall<Saved[]>('GET', '/patient/reports');
    if (r.ok) setSaved(r.data ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const fail = (errors: string[]) => setMsg({ tone: 'danger', text: errors.map((e) => (e === 'NETWORK' ? tr(lang, 'network') : e)).join(' ') });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setDraft(null);
    try {
      const img = await shrink(file);
      const r = await pcall<Draft>('POST', '/patient/reports/read', { profileId: who, mimeType: img.mime, imageBase64: img.base64 });
      if (r.ok && r.data) setDraft(r.data);
      else fail(r.errors);
    } catch {
      fail([tr(lang, 'cannotRead')]);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const edit = (i: number, value: string) => setDraft((d) => (d ? { ...d, values: d.values.map((v, k) => (k === i ? { ...v, value, confidence: value.includes('?') ? 'unclear' : 'clear' } : v)) } : d));
  const unclear = draft ? draft.values.filter((v) => v.value.includes('?')).length : 0;

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const r = await pcall<{ saved: boolean; reason?: string }>('POST', '/patient/reports', { profileId: who, kind: draft.kind, takenOn: draft.takenOn, values: draft.values });
    setBusy(false);
    if (!r.ok) return fail(r.errors);
    if (r.data?.saved) {
      setMsg({ tone: 'success', text: tr(lang, 'reportSaved') });
      setDraft(null);
      load();
    } else setMsg({ tone: 'attention', text: tr(lang, 'reportNotKept'), consent: true });
  };

  const remove = async (id: number) => {
    const r = await pcall('POST', `/patient/reports/${id}/delete`, {});
    if (!r.ok) fail(r.errors);
    load();
  };

  // one line per test that has at least two numeric results for the same person
  const trends = (() => {
    const by = new Map<string, { name: string; unit: string; points: Array<{ date: string; v: number }> }>();
    for (const rep of (saved ?? []).filter((s) => s.profileId === who)) {
      for (const v of rep.values) {
        const n = numeric(v.value);
        if (n === null) continue;
        const key = v.name.trim().toLowerCase();
        const e = by.get(key) ?? { name: v.name, unit: v.unit, points: [] };
        e.points.push({ date: rep.takenOn ?? rep.createdAt.slice(0, 10), v: n });
        by.set(key, e);
      }
    }
    return [...by.values()].map((e) => ({ ...e, points: e.points.sort((a, b) => a.date.localeCompare(b.date)) })).filter((e) => e.points.length >= 2);
  })();

  return (
    <div className="rx-stack" style={{ gap: 18 }}>
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'reportsTitle')}</h1>
        <Button variant="text" onClick={onBack}>{tr(lang, 'back')}</Button>
      </div>

      {session.profiles.length > 1 && (
        <Select label={tr(lang, 'reportFor')} value={who} onChange={(e) => { setWho(Number(e.target.value)); setDraft(null); }}>
          {session.profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </Select>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <Button size="lg" variant="outlined" icon={<Camera size={22} />} disabled={busy || !who} onClick={() => fileRef.current?.click()} fullWidth>
        {busy && !draft ? tr(lang, 'reading') : tr(lang, 'addReport')}
      </Button>

      {msg && (
        <Callout tone={msg.tone}>
          {msg.text}
          {msg.consent && <> <Button variant="text" onClick={onConsent}>{tr(lang, 'goPermissions')}</Button></>}
        </Callout>
      )}

      {draft && (
        <Card active>
          <div className="rx-stack" style={{ gap: 12 }}>
            <div className="rx-stack" style={{ gap: 2 }}>
              <strong className="rx-bn">{tr(lang, 'checkValues')}</strong>
              <span className="rx-pt__meta">{draft.kind}{draft.takenOn ? ` · ${fmtDate(lang, draft.takenOn)}` : ''} · {tr(lang, 'checkValuesHelp')}</span>
            </div>
            {draft.values.map((v, i) => {
              const bad = v.value.includes('?');
              return (
                <div key={i} className="rx-row" style={{ gap: 10, alignItems: 'flex-end', padding: 10, borderRadius: 14, border: bad ? '2px solid var(--rx-attention-solid, var(--rx-outline))' : '1px solid var(--rx-outline)' }}>
                  <div style={{ flex: 1 }}>
                    <TextField label={`${v.name}${v.unit ? ` (${v.unit})` : ''}`} value={v.value} onChange={(e) => edit(i, e.target.value)} inputMode="decimal" />
                  </div>
                  <Badge tone={bad ? 'attention' : 'success'}>{bad ? tr(lang, 'unclearTag') : tr(lang, 'clearTag')}</Badge>
                </div>
              );
            })}
            {unclear > 0 && <Callout tone="attention">{tr(lang, 'fixUnclear')}</Callout>}
            <div className="rx-row" style={{ gap: 8 }}>
              <Button size="lg" onClick={save} disabled={busy || unclear > 0} fullWidth>{tr(lang, 'allCorrect')}</Button>
              <Button variant="outlined" onClick={() => setDraft(null)}>{tr(lang, 'cancel')}</Button>
            </div>
            <span className="rx-pt__meta">{tr(lang, 'reportNote')}</span>
          </div>
        </Card>
      )}

      {trends.map((t) => (
        <Card key={t.name}><Trend lang={lang} name={t.name} unit={t.unit} points={t.points} /></Card>
      ))}

      <h2 className="rx-pt__h2 rx-bn">{tr(lang, 'savedReports')}</h2>
      {saved === null ? <span>{tr(lang, 'loading')}</span> : saved.length === 0 ? <EmptyState icon={<Camera size={32} />} title={tr(lang, 'reportsNone')} /> : (
        <ul className="rx-pt__list">
          {saved.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="rx-stack" style={{ gap: 6 }}>
                  <div className="rx-row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <strong>{s.kind}</strong>
                      <div className="rx-pt__meta">{s.patientName}{s.takenOn ? ` · ${fmtDate(lang, s.takenOn)}` : ''}</div>
                    </div>
                    <Button variant="text" icon={<Trash2 size={16} />} onClick={() => remove(s.id)} aria-label={tr(lang, 'deleteReport')}>{tr(lang, 'deleteReport')}</Button>
                  </div>
                  {s.values.map((v, i) => <div key={i} className="rx-row" style={{ justifyContent: 'space-between' }}><span>{v.name}</span><strong>{v.value} {v.unit}</strong></div>)}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
