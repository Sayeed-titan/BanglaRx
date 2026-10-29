import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, CalendarPlus, CheckCircle2, FileText, LogOut, Phone, ShieldCheck, TriangleAlert, UserPlus } from 'lucide-react';
import { Badge, Button, Callout, Card, Chip, EmptyState, Rx, SegmentedControl, Select, TextField } from '../design-system';
import { fmtDate, fmtTime, num, setLang, tr, useLang } from './i18n';
import type { Key, Lang } from './i18n';
import { pcall, requestCode, setProfiles, signOut, usePatientSession, verifyCode } from './session';
import type { Profile } from './session';
import { MyPrescriptions } from './MyPrescriptions';
import { ConsentScreen, Emergency } from './SafetyScreens';

interface Doctor {
  id: number;
  name: string;
  degrees: string;
  specialization: string;
  hospitalName: string;
  consultationFee: number | null;
  nextFree: { date: string; time: string; branch: string } | null;
}
interface Booking {
  id: number;
  doctorName: string;
  branchName: string;
  patientName: string;
  date: string;
  time: string;
  status: string;
  tokenNumber: number | null;
}
interface BookingRow {
  booking: Booking;
  canCancel: boolean;
}
interface QueuePos {
  bookingId: number;
  patientName: string;
  doctorName: string;
  token: number;
  nowServing: number | null;
  ahead: number;
}
interface Slot {
  time: string;
  minutes: number;
  branchName: string;
}

/** Server messages are in English; connection failures are shown in the chosen language. */
const say = (l: Lang, errors: string[]) => errors.map((e) => (e === 'NETWORK' ? tr(l, 'network') : e));

const isoPlus = (start: string, days: number) => {
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const localToday = () => isoPlus(new Date().toISOString().slice(0, 10), 0);

const STATUS: Record<string, { key: Key; tone: 'primary' | 'success' | 'neutral' | 'attention' | 'danger' }> = {
  booked: { key: 'booked', tone: 'primary' },
  arrived: { key: 'arrived', tone: 'success' },
  completed: { key: 'completed', tone: 'neutral' },
  cancelled: { key: 'cancelledState', tone: 'neutral' },
  no_show: { key: 'noshow', tone: 'attention' },
};

/* ------------------------------------------------------------------------------------------------ */

const LangToggle: React.FC<{ lang: Lang }> = ({ lang }) => (
  <SegmentedControl label={tr(lang, 'language')} value={lang} onChange={setLang} options={[{ value: 'bn', label: 'বাংলা' }, { value: 'en', label: 'English' }]} />
);

const Shell: React.FC<{ lang: Lang; signedIn?: boolean; children: React.ReactNode }> = ({ lang, signedIn, children }) => (
  <Rx density="patient" className="rx-pt">
    <header className="rx-pt__bar">
      <strong className="rx-pt__brand rx-bn">{tr(lang, 'appName')}</strong>
      <div className="rx-row">
        <LangToggle lang={lang} />
        {signedIn && (
          <Button variant="text" icon={<LogOut size={18} />} onClick={() => signOut()}>
            {tr(lang, 'signOut')}
          </Button>
        )}
      </div>
    </header>
    <main className="rx-pt__main">{children}</main>
  </Rx>
);

/* ---- sign in: phone, then the code ---------------------------------------------------------------- */

const SignIn: React.FC<{ lang: Lang }> = ({ lang }) => {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setErrors([]);
    const r = await requestCode(phone);
    setBusy(false);
    if (r.ok) {
      setCode('');
      setDemoCode(r.data?.demoCode ?? null);
      setStep('code');
    } else setErrors(say(lang, r.errors));
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors([]);
    const r = await verifyCode(phone, code);
    setBusy(false);
    if (!r.ok) setErrors(say(lang, r.errors));
  };

  return (
    <Card>
      {step === 'phone' ? (
        <form className="rx-stack" style={{ gap: 18 }} onSubmit={send}>
          <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'signInTitle')}</h1>
          <p className="rx-pt__lead">{tr(lang, 'signInLead')}</p>
          <TextField label={tr(lang, 'phone')} helper={tr(lang, 'phoneHelp')} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          {errors.length > 0 && <Callout tone="danger">{errors.join(' ')}</Callout>}
          <Button size="lg" type="submit" disabled={busy || phone.trim().length < 6} icon={<Phone size={20} />} fullWidth>
            {tr(lang, 'sendCode')}
          </Button>
          <p className="rx-pt__note">{tr(lang, 'privacy')}</p>
        </form>
      ) : (
        <form className="rx-stack" style={{ gap: 18 }} onSubmit={verify}>
          <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'codeTitle')}</h1>
          <p className="rx-pt__lead">
            {tr(lang, 'codeLead')} <strong>{phone}</strong>
          </p>
          {demoCode && (
            <Callout tone="attention" title="Demo mode: no real SMS is sent">
              Your code is <strong style={{ fontSize: 22, letterSpacing: 4 }}>{demoCode}</strong>
            </Callout>
          )}
          <TextField label={tr(lang, 'code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
          {errors.length > 0 && <Callout tone="danger">{errors.join(' ')}</Callout>}
          <Button size="lg" type="submit" disabled={busy || code.length !== 6} fullWidth>
            {tr(lang, 'verify')}
          </Button>
          <div className="rx-row" style={{ justifyContent: 'space-between' }}>
            <Button variant="text" onClick={() => { setStep('phone'); setErrors([]); }}>
              {tr(lang, 'wrongNumber')}
            </Button>
            <Button variant="text" disabled={busy} onClick={() => send()}>
              {tr(lang, 'resend')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};

/* ---- home ----------------------------------------------------------------------------------------- */

const AddPerson: React.FC<{ lang: Lang; onDone: () => void; onCancel: () => void }> = ({ lang, onDone, onCancel }) => {
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await pcall<{ profiles: Profile[] }>('POST', '/patient/profiles', { fullName, age: Number(age), gender });
    setBusy(false);
    if (r.ok && r.data) {
      setProfiles(r.data.profiles);
      onDone();
    } else setErrors(say(lang, r.errors));
  };

  return (
    <Card>
      <form className="rx-stack" style={{ gap: 16 }} onSubmit={save}>
        <h2 className="rx-pt__h2 rx-bn">{tr(lang, 'addPerson')}</h2>
        <TextField label={tr(lang, 'fullName')} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <TextField label={tr(lang, 'age')} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ''))} suffix={tr(lang, 'years')} required />
        <SegmentedControl label={tr(lang, 'gender')} value={gender} onChange={setGender} options={(['Female', 'Male', 'Other'] as const).map((g) => ({ value: g, label: tr(lang, g) }))} />
        {errors.length > 0 && <Callout tone="danger">{errors.join(' ')}</Callout>}
        <div className="rx-row">
          <Button type="submit" disabled={busy || !fullName.trim() || !age}>{tr(lang, 'save')}</Button>
          <Button variant="text" onClick={onCancel}>{tr(lang, 'cancel')}</Button>
        </div>
      </form>
    </Card>
  );
};

const Home: React.FC<{ lang: Lang; onBook: () => void; onRx: () => void; onConsent: () => void; onEmergency: () => void }> = ({ lang, onBook, onRx, onConsent, onEmergency }) => {
  const session = usePatientSession()!;
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [queue, setQueue] = useState<QueuePos[]>([]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [b, q] = await Promise.all([pcall<BookingRow[]>('GET', '/patient/bookings'), pcall<QueuePos[]>('GET', '/patient/queue')]);
    if (b.ok) setRows(b.data ?? []);
    else if (b.status !== 401) setNotice({ tone: 'danger', text: say(lang, b.errors).join(' ') });
    if (q.ok) setQueue(q.data ?? []);
  }, [lang]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 20000); // the line moves while the patient waits
    return () => window.clearInterval(t);
  }, [load]);

  const cancel = async (id: number) => {
    const r = await pcall('POST', `/patient/bookings/${id}/cancel`);
    setNotice(r.ok ? { tone: 'success', text: tr(lang, 'cancelled') } : { tone: 'danger', text: say(lang, r.errors).join(' ') });
    load();
  };

  const upcoming = (rows ?? []).filter((r) => r.booking.status === 'booked' || r.booking.status === 'arrived').sort((a, b) => `${a.booking.date}${a.booking.time}`.localeCompare(`${b.booking.date}${b.booking.time}`));
  const past = (rows ?? []).filter((r) => !upcoming.includes(r));

  const Line: React.FC<{ r: BookingRow }> = ({ r }) => {
    const s = STATUS[r.booking.status] ?? { key: 'booked' as Key, tone: 'neutral' as const };
    return (
      <li className="rx-pt__booking">
        <div>
          <strong>{r.booking.doctorName}</strong>
          <div className="rx-pt__meta">
            {fmtDate(lang, r.booking.date)} · {fmtTime(lang, r.booking.time)} · {r.booking.branchName}
          </div>
          <div className="rx-pt__meta">{r.booking.patientName}</div>
        </div>
        <div className="rx-stack" style={{ alignItems: 'flex-end', gap: 8 }}>
          <Badge tone={s.tone}>{tr(lang, s.key)}</Badge>
          {r.booking.status === 'booked' && (r.canCancel ? <Button variant="outlined" onClick={() => cancel(r.booking.id)}>{tr(lang, 'cancelBooking')}</Button> : <span className="rx-pt__meta">{tr(lang, 'cancelTooLate')}</span>)}
        </div>
      </li>
    );
  };

  return (
    <div className="rx-stack" style={{ gap: 20 }}>
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'hello')}</h1>
        <Button variant="outlined" icon={<TriangleAlert size={18} />} onClick={onEmergency} style={{ color: 'var(--rx-danger-solid)' }}>{tr(lang, 'emergencyBtn')}</Button>
      </div>

      {notice && <Callout tone={notice.tone}>{notice.text}</Callout>}

      {queue.map((q) => (
        <Card key={q.bookingId} active>
          <div className="rx-stack" style={{ gap: 10 }}>
            <strong className="rx-bn">{tr(lang, 'inLine')} · {q.patientName}</strong>
            <div className="rx-stats">
              <div className="rx-pt__big"><span>{tr(lang, 'yourToken')}</span><strong>#{num(lang, q.token)}</strong></div>
              <div className="rx-pt__big"><span>{tr(lang, 'nowServing')}</span><strong>{q.nowServing ? `#${num(lang, q.nowServing)}` : '—'}</strong></div>
              <div className="rx-pt__big"><span>{tr(lang, 'ahead')}</span><strong>{num(lang, q.ahead)}</strong></div>
            </div>
          </div>
        </Card>
      ))}

      <Button size="lg" icon={<CalendarPlus size={20} />} onClick={onBook} disabled={session.profiles.length === 0} fullWidth>
        {tr(lang, 'bookNew')}
      </Button>
      <Button variant="outlined" size="lg" icon={<FileText size={20} />} onClick={onRx} disabled={session.profiles.length === 0} fullWidth>
        {tr(lang, 'myRxBtn')}
      </Button>
      <Button variant="text" icon={<ShieldCheck size={18} />} onClick={onConsent}>{tr(lang, 'consentBtn')}</Button>

      <Card>
        <div className="rx-stack" style={{ gap: 12 }}>
          <h2 className="rx-pt__h2 rx-bn">{tr(lang, 'upcoming')}</h2>
          {rows === null ? <span>{tr(lang, 'loading')}</span> : upcoming.length === 0 ? <EmptyState icon={<CalendarCheck size={32} />} title={tr(lang, 'noUpcoming')} /> : <ul className="rx-pt__list">{upcoming.map((r) => <Line key={r.booking.id} r={r} />)}</ul>}
        </div>
      </Card>

      <Card>
        <div className="rx-stack" style={{ gap: 12 }}>
          <h2 className="rx-pt__h2 rx-bn">{tr(lang, 'myPeople')}</h2>
          {session.profiles.length === 0 ? (
            <Callout tone="info">{tr(lang, 'noPeople')}</Callout>
          ) : (
            <ul className="rx-pt__list">
              {session.profiles.map((p) => (
                <li key={p.id} className="rx-pt__booking">
                  <strong>{p.fullName}</strong>
                  <span className="rx-pt__meta">{num(lang, p.age)} {tr(lang, 'years')} · {tr(lang, p.gender)}</span>
                </li>
              ))}
            </ul>
          )}
          {adding ? <AddPerson lang={lang} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} /> : <Button variant="tonal" icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>{tr(lang, 'addPerson')}</Button>}
        </div>
      </Card>

      {past.length > 0 && (
        <Card>
          <div className="rx-stack" style={{ gap: 12 }}>
            <h2 className="rx-pt__h2 rx-bn">{tr(lang, 'past')}</h2>
            <ul className="rx-pt__list">{past.slice(0, 10).map((r) => <Line key={r.booking.id} r={r} />)}</ul>
          </div>
        </Card>
      )}
    </div>
  );
};

/* ---- book: doctor, day, time, who, confirm ------------------------------------------------------- */

const Book: React.FC<{ lang: Lang; onDone: () => void }> = ({ lang, onDone }) => {
  const session = usePatientSession()!;
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [who, setWho] = useState<number>(session.profiles[0]?.id ?? 0);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState<Booking | null>(null);

  useEffect(() => {
    pcall<Doctor[]>('GET', '/patient/doctors').then((r) => (r.ok ? setDoctors(r.data ?? []) : setErrors(say(lang, r.errors))));
  }, [lang]);

  useEffect(() => {
    if (!doctor || !date) return;
    setSlots(null);
    setSlot(null);
    pcall<{ slots: Slot[] }>('GET', `/patient/slots?doctorId=${doctor.id}&date=${date}`).then((r) => (r.ok ? setSlots(r.data?.slots ?? []) : setErrors(say(lang, r.errors))));
  }, [doctor, date, lang]);

  const pickDoctor = (d: Doctor) => {
    setDoctor(d);
    setDate(d.nextFree?.date ?? null);
    setErrors([]);
  };

  const confirm = async () => {
    if (!doctor || !date || !slot) return;
    setBusy(true);
    setErrors([]);
    const r = await pcall<Booking>('POST', '/patient/bookings', { doctorId: doctor.id, date, time: slot.time, profileId: who, reason: reason.trim() || null, channel: 'app' });
    setBusy(false);
    if (r.ok && r.data) setBooked(r.data);
    else {
      setErrors(say(lang, r.errors));
      if (r.status === 409) setDate(date); // someone took it: reload the free times
      if (r.status === 409 && doctor) pcall<{ slots: Slot[] }>('GET', `/patient/slots?doctorId=${doctor.id}&date=${date}`).then((x) => { setSlots(x.data?.slots ?? []); setSlot(null); });
    }
  };

  if (booked) {
    return (
      <Card>
        <div className="rx-stack" style={{ gap: 14, alignItems: 'center', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="var(--rx-success)" aria-hidden="true" />
          <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'doneTitle')}</h1>
          <strong>{booked.doctorName}</strong>
          <span>{fmtDate(lang, booked.date)} · {fmtTime(lang, booked.time)} · {booked.branchName}</span>
          <span>{booked.patientName}</span>
          <p className="rx-pt__lead">{tr(lang, 'doneLead')}</p>
          <Button size="lg" onClick={onDone}>{tr(lang, 'backHome')}</Button>
        </div>
      </Card>
    );
  }

  const days = doctor ? Array.from({ length: 14 }, (_, i) => isoPlus(doctor.nextFree?.date ?? localToday(), i)) : [];

  return (
    <div className="rx-stack" style={{ gap: 20 }}>
      <div className="rx-row" style={{ justifyContent: 'space-between' }}>
        <h1 className="rx-pt__h1 rx-bn">{tr(lang, 'bookNew')}</h1>
        <Button variant="text" onClick={onDone}>{tr(lang, 'back')}</Button>
      </div>

      <section className="rx-stack" style={{ gap: 12 }} aria-label={tr(lang, 'chooseDoctor')}>
        <h2 className="rx-pt__h2 rx-bn">1. {tr(lang, 'chooseDoctor')}</h2>
        {doctors === null ? <span>{tr(lang, 'loading')}</span> : doctors.length === 0 ? <Callout tone="info">{tr(lang, 'noDoctors')}</Callout> : (
          <ul className="rx-pt__list">
            {doctors.map((d) => (
              <li key={d.id}>
                <Card active={doctor?.id === d.id}>
                  <div className="rx-pt__booking">
                    <div>
                      <strong>{d.name}</strong>
                      <div className="rx-pt__meta">{[d.degrees, d.specialization].filter(Boolean).join(' · ')}</div>
                      <div className="rx-pt__meta">
                        {d.nextFree ? `${tr(lang, 'nextFree')}: ${fmtDate(lang, d.nextFree.date)}, ${fmtTime(lang, d.nextFree.time)}` : tr(lang, 'noFree')}
                        {d.consultationFee != null && ` · ${tr(lang, 'fee')} ৳${num(lang, d.consultationFee)}`}
                      </div>
                    </div>
                    <Button variant={doctor?.id === d.id ? 'filled' : 'outlined'} onClick={() => pickDoctor(d)} aria-pressed={doctor?.id === d.id}>{tr(lang, 'choose')}</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {doctor && (
        <section className="rx-stack" style={{ gap: 12 }} aria-label={tr(lang, 'chooseDay')}>
          <h2 className="rx-pt__h2 rx-bn">2. {tr(lang, 'chooseDay')}</h2>
          <div className="rx-pt__chips">
            {days.map((d) => <Chip key={d} selected={date === d} onClick={() => setDate(d)}>{fmtDate(lang, d)}</Chip>)}
          </div>
        </section>
      )}

      {doctor && date && (
        <section className="rx-stack" style={{ gap: 12 }} aria-label={tr(lang, 'chooseTime')}>
          <h2 className="rx-pt__h2 rx-bn">3. {tr(lang, 'chooseTime')}</h2>
          {slots === null ? <span>{tr(lang, 'loading')}</span> : slots.length === 0 ? <Callout tone="attention">{tr(lang, 'noSlotsDay')}</Callout> : (
            <div className="rx-pt__chips">
              {slots.map((s) => <Chip key={s.time} selected={slot?.time === s.time} onClick={() => setSlot(s)}>{fmtTime(lang, s.time)}</Chip>)}
            </div>
          )}
        </section>
      )}

      {slot && (
        <section className="rx-stack" style={{ gap: 12 }} aria-label={tr(lang, 'whoFor')}>
          <h2 className="rx-pt__h2 rx-bn">4. {tr(lang, 'whoFor')}</h2>
          <Select label={tr(lang, 'whoFor')} value={who} onChange={(e) => setWho(Number(e.target.value))}>
            {session.profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </Select>
          <TextField label={tr(lang, 'reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          <Callout tone="info" title={tr(lang, 'review')}>
            {doctor?.name} · {date && fmtDate(lang, date)} · {fmtTime(lang, slot.time)} · {slot.branchName}
          </Callout>
          {errors.length > 0 && <Callout tone="danger">{errors.join(' ')}</Callout>}
          <Button size="lg" onClick={confirm} disabled={busy || !who} fullWidth>{tr(lang, 'confirm')}</Button>
        </section>
      )}

      {!slot && errors.length > 0 && <Callout tone="danger">{errors.join(' ')}</Callout>}
    </div>
  );
};

/* ---- the app ---------------------------------------------------------------------------------------- */

/** The patient side of BanglaRx (#/patient). Sign in by phone code, see the line, book and cancel for yourself and family. */
export const PatientApp: React.FC = () => {
  const lang = useLang();
  const session = usePatientSession();
  const [screen, setScreen] = useState<'home' | 'book' | 'rx' | 'consent' | 'emergency'>('home');

  if (!session) {
    return (
      <Shell lang={lang}>
        <SignIn lang={lang} />
      </Shell>
    );
  }
  return (
    <Shell lang={lang} signedIn>
      {screen === 'home' && <Home lang={lang} onBook={() => setScreen('book')} onRx={() => setScreen('rx')} onConsent={() => setScreen('consent')} onEmergency={() => setScreen('emergency')} />}
      {screen === 'book' && <Book lang={lang} onDone={() => setScreen('home')} />}
      {screen === 'rx' && <MyPrescriptions lang={lang} onBack={() => setScreen('home')} />}
      {screen === 'consent' && <ConsentScreen lang={lang} onBack={() => setScreen('home')} />}
      {screen === 'emergency' && <Emergency lang={lang} onBack={() => setScreen('home')} />}
    </Shell>
  );
};
