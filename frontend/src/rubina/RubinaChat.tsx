import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Headset, Send, UserRound } from 'lucide-react';
import { API_BASE } from '../api';
import { Button, Callout, Card, Chip, Rx, SegmentedControl, TextField } from '../design-system';
import { fmtDate, fmtTime, num, setLang, tr, useLang } from '../patient/i18n';
import type { Lang } from '../patient/i18n';
import { EmergencyCard } from '../patient/SafetyScreens';
import { useInstall } from '../pwa/useInstall';

interface Msg {
  id: number;
  sender: 'patient' | 'rubina' | 'staff';
  body: string;
}
interface DoctorCard {
  id: number;
  name: string;
  degrees: string;
  specialization: string;
  consultationFee: number | null;
  nextFree: { date: string; time: string; branch: string } | null;
}
interface ChatReply {
  token: string;
  status: 'rubina' | 'needs_human' | 'human' | 'booked';
  emergency?: boolean;
  doctors?: DoctorCard[];
  messages: Array<{ id: number; sender: Msg['sender']; body: string }>;
  errors?: string[];
}

const TOKEN_KEY = 'banglarx.rubina.token';
export const PENDING_DOCTOR_KEY = 'banglarx.pending.doctor';

const read = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    /* the chat still works for this visit */
  }
};

/** Public booking helper. Anyone can open it; signing in is only asked when they press Book. */
export const RubinaChat: React.FC = () => {
  const lang: Lang = useLang();
  const pwa = useInstall();
  const [token, setToken] = useState<string | null>(() => read(TOKEN_KEY));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ChatReply['status']>('rubina');
  const [doctors, setDoctors] = useState<DoctorCard[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);

  const add = useCallback((incoming: ChatReply['messages']) => {
    if (incoming.length === 0) return;
    setMsgs((cur) => {
      const have = new Set(cur.map((m) => m.id));
      const fresh = incoming.filter((m) => !have.has(m.id));
      return fresh.length ? [...cur, ...fresh] : cur;
    });
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id));
  }, []);

  // pick the conversation up again after a reload
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/public/chat/${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          write(TOKEN_KEY, null);
          setToken(null);
          return;
        }
        setStatus(d.status);
        add(d.messages);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // while a person is involved, look for their replies
  useEffect(() => {
    if (!token || (status !== 'needs_human' && status !== 'human')) return;
    const t = window.setInterval(() => {
      fetch(`${API_BASE}/public/chat/${token}?after=${lastId.current}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          setStatus(d.status);
          add(d.messages);
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(t);
  }, [token, status, add]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs.length, busy]);

  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || busy) return;
    setBusy(true);
    setError('');
    setText('');
    setEmergency(false);
    setDoctors([]);
    try {
      const res = await fetch(`${API_BASE}/public/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, text: t }) });
      const d: ChatReply = await res.json().catch(() => ({ token: '', status: 'rubina', messages: [] }));
      if (!res.ok) {
        setError((d.errors ?? [tr(lang, 'network')]).join(' '));
        setText(t);
      } else {
        if (d.token !== token) {
          write(TOKEN_KEY, d.token);
          setToken(d.token);
        }
        setStatus(d.status);
        setEmergency(!!d.emergency);
        setDoctors(d.doctors ?? []);
        add(d.messages);
      }
    } catch {
      setError(tr(lang, 'network'));
      setText(t);
    }
    setBusy(false);
  };

  const askPerson = async () => {
    if (!token) {
      await send(lang === 'bn' ? 'আমি একজন মানুষের সাথে কথা বলতে চাই' : 'I would like to talk to a person');
      return;
    }
    setBusy(true);
    const r = await fetch(`${API_BASE}/public/chat/${token}/human`, { method: 'POST' }).catch(() => null);
    if (r?.ok) {
      setStatus('needs_human');
      const d = await fetch(`${API_BASE}/public/chat/${token}?after=${lastId.current}`).then((x) => x.json()).catch(() => null);
      if (d) add(d.messages);
    } else setError(tr(lang, 'network'));
    setBusy(false);
  };

  const book = (d: DoctorCard) => {
    write(PENDING_DOCTOR_KEY, String(d.id));
    window.location.hash = '#/patient';
  };

  const suggestions = [tr(lang, 'rubinaSug1'), tr(lang, 'rubinaSug2'), tr(lang, 'rubinaSug3')];

  return (
    <Rx density="patient" className="rx-pt">
      <header className="rx-pt__bar">
        <strong className="rx-pt__brand rx-bn">Rubina · BanglaRx</strong>
        <div className="rx-row">
          <SegmentedControl label={tr(lang, 'language')} value={lang} onChange={setLang} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} />
          {pwa.canInstall && <Button variant="tonal" onClick={pwa.install}>{tr(lang, 'installApp')}</Button>}
          <Button variant="text" icon={<UserRound size={18} />} onClick={() => (window.location.hash = '#/patient')}>{tr(lang, 'myAccount')}</Button>
        </div>
      </header>
      <main className="rx-pt__main">
        <div className="rx-stack" style={{ gap: 16 }}>
          <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'rubinaTitle')}</h1>
          <p className="rx-pt__lead rx-bn">{tr(lang, 'rubinaIntro')}</p>

          {msgs.length === 0 && (
            <div className="rx-pt__chips">
              {suggestions.map((s) => <Chip key={s} onClick={() => send(s)}>{s}</Chip>)}
            </div>
          )}

          <div className="rx-stack" style={{ gap: 10 }} aria-live="polite">
            {msgs.map((m) => (
              <div key={m.id} style={{ alignSelf: m.sender === 'patient' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                <div className="rx-pt__meta">{m.sender === 'patient' ? tr(lang, 'youLbl') : m.sender === 'rubina' ? 'Rubina (AI)' : tr(lang, 'receptionLbl')}</div>
                <div className="rx-bn" style={{ padding: '10px 14px', borderRadius: 18, background: m.sender === 'patient' ? 'var(--rx-primary-container)' : 'var(--rx-surface-2)', color: m.sender === 'patient' ? 'var(--rx-on-primary-container)' : 'var(--rx-ink)', lineHeight: 1.55 }}>
                  {m.body}
                </div>
              </div>
            ))}
            {busy && <span className="rx-pt__meta">{tr(lang, 'typing')}</span>}
            <div ref={endRef} />
          </div>

          {emergency && <EmergencyCard lang={lang} />}

          {doctors.map((d) => (
            <Card key={d.id}>
              <div className="rx-pt__booking">
                <div>
                  <strong>{d.name}</strong>
                  <div className="rx-pt__meta">{[d.degrees, d.specialization].filter(Boolean).join(' · ')}</div>
                  <div className="rx-pt__meta">
                    {d.nextFree ? `${tr(lang, 'nextFree')}: ${fmtDate(lang, d.nextFree.date)}, ${fmtTime(lang, d.nextFree.time)} · ${d.nextFree.branch}` : tr(lang, 'noFree')}
                    {d.consultationFee != null && ` · ${tr(lang, 'fee')} ৳${num(lang, d.consultationFee)}`}
                  </div>
                </div>
                <Button onClick={() => book(d)} disabled={!d.nextFree}>{tr(lang, 'bookThis')}</Button>
              </div>
            </Card>
          ))}

          {(status === 'needs_human' || status === 'human') && (
            <Callout tone="info" icon={<Headset size={20} />}>{status === 'human' ? tr(lang, 'personHere') : tr(lang, 'personComing')}</Callout>
          )}
          {error && <Callout tone="danger">{error}</Callout>}

          <form
            className="rx-row"
            style={{ alignItems: 'flex-end', gap: 8, flexWrap: 'nowrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <div style={{ flex: 1 }}>
              <TextField label={tr(lang, 'typeMessage')} placeholder={tr(lang, 'typeMessage')} value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
            </div>
            <Button type="submit" icon={<Send size={18} />} disabled={busy || !text.trim()}>{tr(lang, 'sendMsg')}</Button>
          </form>

          {status === 'rubina' && (
            <Button variant="text" icon={<Headset size={18} />} onClick={askPerson} disabled={busy}>{tr(lang, 'talkToPerson')}</Button>
          )}
          {pwa.iosHint && <span className="rx-pt__meta">{tr(lang, 'iosInstall')}</span>}
          <span className="rx-pt__meta">{tr(lang, 'rubinaNote')}</span>
        </div>
      </main>
    </Rx>
  );
};
