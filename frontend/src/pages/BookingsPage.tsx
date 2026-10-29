import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState, IconButton, PageHeader, SegmentedControl, Select, TextField } from '../design-system';
import { getJson, sendJson } from '../api';
import { useSession } from '../auth/session';

interface Slot {
  time: string;
  minutes: number;
  branchId: number;
  branchName: string;
  state: 'open' | 'booked' | 'closed';
  bookingId?: number;
}
interface SlotDay {
  date: string;
  doctorId: number;
  note?: string;
  slots: Slot[];
}
interface Booking {
  id: number;
  doctorId: number;
  doctorName: string;
  branchName: string;
  patientId: number;
  patientName: string;
  patientPhone?: string;
  date: string;
  time: string;
  minutes: number;
  status: 'booked' | 'arrived' | 'cancelled' | 'no_show';
  source: string;
  reason?: string;
  tokenNumber?: number;
  cancelReason?: string;
}
interface Doctor {
  id: number;
  name: string;
  specialization: string;
}
interface Patient {
  id: number;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
}
interface Info {
  today: string;
  now: string;
  maxDaysAhead: number;
}

const SOURCES: Array<{ value: string; label: string }> = [
  { value: 'front_desk', label: 'At the front desk' },
  { value: 'phone', label: 'By phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'app', label: 'Patient app' },
  { value: 'web', label: 'Website' },
];
const STATUS_TEXT: Record<Booking['status'], { text: string; tone: 'primary' | 'success' | 'neutral' | 'attention' }> = {
  booked: { text: 'Booked', tone: 'primary' },
  arrived: { text: 'Arrived', tone: 'success' },
  cancelled: { text: 'Cancelled', tone: 'neutral' },
  no_show: { text: 'No-show', tone: 'attention' },
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** One booking in the day's list, with the things the front desk does to it. */
function BookingRow({ b, info, canWrite, onChanged }: { b: Booking; info: Info; canWrite: boolean; onChanged: (message?: string) => void }) {
  const [mode, setMode] = useState<'view' | 'cancel' | 'move'>('view');
  const [reason, setReason] = useState('');
  const [moveDate, setMoveDate] = useState(b.date);
  const [moveOptions, setMoveOptions] = useState<Slot[]>([]);
  const [moveTime, setMoveTime] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const s = STATUS_TEXT[b.status];

  useEffect(() => {
    if (mode !== 'move') return;
    getJson<SlotDay>(`/slots?doctorId=${b.doctorId}&date=${moveDate}&onlyOpen=true`)
      .then((d) => {
        setMoveOptions(d.slots);
        setMoveTime(d.slots[0]?.time ?? '');
      })
      .catch(() => setMoveOptions([]));
  }, [mode, moveDate, b.doctorId]);

  const run = async (fn: () => Promise<{ ok: boolean; errors: string[] }>, message: string) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setErrors(res.errors);
    setErrors([]);
    setMode('view');
    onChanged(message);
  };

  const live = b.status === 'booked';
  return (
    <Card style={{ padding: '14px 18px' }}>
      <div className="rx-stack" style={{ gap: 10 }}>
        <div className="rx-row" style={{ flexWrap: 'nowrap', gap: 14 }}>
          <div style={{ flex: 'none', minWidth: 64, textAlign: 'center', lineHeight: 1.1 }}>
            <strong style={{ fontSize: 22 }}>{b.time}</strong>
            <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{b.minutes} min</div>
          </div>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
            <strong style={{ fontSize: 16 }}>{b.patientName}</strong>
            <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
              {b.patientPhone ?? 'No phone'} · {SOURCES.find((x) => x.value === b.source)?.label ?? b.source}
              {b.reason ? ` · ${b.reason}` : ''}
            </div>
          </div>
          <div className="rx-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            {b.tokenNumber != null && <Badge tone="success">Token {b.tokenNumber}</Badge>}
            <Badge tone={s.tone}>{s.text}</Badge>
          </div>
        </div>

        {b.status === 'cancelled' && b.cancelReason && <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Reason: {b.cancelReason}</span>}

        {canWrite && live && mode === 'view' && (
          <div className="rx-row" style={{ gap: 8 }}>
            {b.date === info.today && (
              <Button icon={<UserCheck size={18} />} disabled={busy} onClick={() => run(() => sendJson('POST', `/bookings/${b.id}/arrive`, {}), `${b.patientName} is in the queue.`)}>
                Arrived
              </Button>
            )}
            <Button variant="outlined" onClick={() => setMode('move')}>Move</Button>
            <Button variant="outlined" onClick={() => setMode('cancel')}>Cancel</Button>
            {b.date <= info.today && (
              <Button variant="text" disabled={busy} onClick={() => run(() => sendJson('POST', `/bookings/${b.id}/no-show`, {}), `${b.patientName} marked as a no-show.`)}>
                No-show
              </Button>
            )}
          </div>
        )}

        {mode === 'cancel' && (
          <div className="rx-row" style={{ alignItems: 'flex-end', gap: 10 }}>
            <TextField label="Why is it cancelled? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="danger" disabled={busy} onClick={() => run(() => sendJson('POST', `/bookings/${b.id}/cancel`, { reason }), 'The booking was cancelled and the time is free again.')}>
              Cancel the booking
            </Button>
            <Button variant="text" onClick={() => setMode('view')}>Keep it</Button>
          </div>
        )}

        {mode === 'move' && (
          <div className="rx-row" style={{ alignItems: 'flex-end', gap: 10 }}>
            <TextField label="New day" type="date" min={info.today} max={addDays(info.today, info.maxDaysAhead)} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
            <Select label="New time" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} disabled={moveOptions.length === 0}>
              {moveOptions.length === 0 && <option value="">No free times</option>}
              {moveOptions.map((o) => <option key={o.time} value={o.time}>{o.time}</option>)}
            </Select>
            <Button disabled={busy || !moveTime} onClick={() => run(() => sendJson('PUT', `/bookings/${b.id}/move`, { date: moveDate, time: moveTime }), `Moved to ${longDate(moveDate)}, ${moveTime}.`)}>Move it</Button>
            <Button variant="text" onClick={() => setMode('view')}>Back</Button>
          </div>
        )}

        {errors.length > 0 && <Callout tone="danger" title="This was not changed">{errors.join(' ')}</Callout>}
      </div>
    </Card>
  );
}

/**
 * The front desk's booking desk: pick a doctor and a day, see every time, book one.
 * A booking becomes a queue token when the patient arrives. Doctors and assistants see their own doctor's day, read-only.
 */
export const BookingsPage: React.FC = () => {
  const session = useSession();
  const role = session?.user.role;
  // with sign-in switched off nobody is signed in and the desk works as it always could
  const canWrite = !role || role === 'receptionist' || role === 'manager';
  const ownDoctor = role === 'doctor' || role === 'assistant' ? session?.user.doctorId : undefined;

  const [info, setInfo] = useState<Info | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [day, setDay] = useState<SlotDay | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [picked, setPicked] = useState<string | null>(null);
  const [who, setWho] = useState<'existing' | 'new'>('existing');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState<number | ''>('');
  const [np, setNp] = useState({ fullName: '', age: '', gender: 'Female', phone: '' });
  const [reason, setReason] = useState('');
  const [source, setSource] = useState('front_desk');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([getJson<Info>('/booking/info'), getJson<Doctor[]>('/doctors')])
      .then(([i, d]) => {
        const mine = ownDoctor ? d.filter((x) => x.id === ownDoctor) : d;
        setInfo(i);
        setDate(i.today);
        setDoctors(mine);
        setDoctorId(mine[0]?.id ?? '');
      })
      .catch(() => setLoadError(true));
  }, [ownDoctor]);

  const refresh = useCallback(async () => {
    if (doctorId === '' || !date) return;
    try {
      const [s, b] = await Promise.all([
        getJson<SlotDay>(`/slots?doctorId=${doctorId}&date=${date}`),
        getJson<Booking[]>(`/bookings?date=${date}&doctorId=${doctorId}`),
      ]);
      setDay(s);
      setBookings(b);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [doctorId, date]);

  useEffect(() => {
    setPicked(null);
    setErrors([]);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (canWrite && who === 'existing' && patients.length === 0) getJson<Patient[]>('/patients').then(setPatients).catch(() => undefined);
  }, [canWrite, who, patients.length]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients.filter((p) => !q || p.full_name.toLowerCase().includes(q) || p.phone.includes(q)).slice(0, 8);
  }, [patients, search]);

  const live = bookings.filter((b) => b.status === 'booked' || b.status === 'arrived');
  const nameAt = (time: string) => live.find((b) => b.time === time)?.patientName;
  const doctor = doctors.find((d) => d.id === doctorId);
  const slot = day?.slots.find((s) => s.time === picked);

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setNotice('');
    setBusy(true);
    const body: Record<string, unknown> = { doctorId, date, time: picked, reason, source };
    if (who === 'existing') body.patientId = patientId || null;
    else body.newPatient = { fullName: np.fullName, age: np.age === '' ? null : Number(np.age), gender: np.gender, phone: np.phone };
    const res = await sendJson<Booking>('POST', '/bookings', body);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.errors);
      if (res.status === 409) refresh();
      return;
    }
    setNotice(`${res.data?.patientName} is booked for ${longDate(date)} at ${picked}.`);
    setPicked(null);
    setReason('');
    setPatientId('');
    setSearch('');
    setNp({ fullName: '', age: '', gender: 'Female', phone: '' });
    if (who === 'new') setPatients([]);
    refresh();
  };

  return (
    <div className="rx-page">
      <PageHeader title="Bookings" subtitle="Choose a doctor and a day, then a time" backHref="#/queue" backLabel="Back to the queue" />

      <main className="rx-split">
        <div className="rx-split__main">
          {loadError && <Callout tone="attention" title="Can't reach the server">Start the BanglaRx API (and sign in if it asks), then reload.</Callout>}
          {notice && <Callout tone="success" title="Booked">{notice}</Callout>}

          <Card>
            <div className="rx-stack" style={{ gap: 14 }}>
              <div className="rx-row" style={{ alignItems: 'flex-end', gap: 12 }}>
                <Select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(Number(e.target.value))} style={{ minWidth: 240 }}>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <div className="rx-row" style={{ alignItems: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                  <IconButton aria-label="Previous day" onClick={() => info && date > info.today && setDate(addDays(date, -1))} disabled={!info || date <= info.today}><ChevronLeft size={22} /></IconButton>
                  <TextField label="Day" type="date" value={date} min={info?.today} max={info ? addDays(info.today, info.maxDaysAhead) : undefined} onChange={(e) => e.target.value && setDate(e.target.value)} />
                  <IconButton aria-label="Next day" onClick={() => info && date < addDays(info.today, info.maxDaysAhead) && setDate(addDays(date, 1))} disabled={!info || date >= addDays(info.today, info.maxDaysAhead)}><ChevronRight size={22} /></IconButton>
                </div>
                {info && date !== info.today && <Button variant="text" onClick={() => setDate(info.today)}>Today</Button>}
              </div>
              <div style={{ fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)' }}>
                {date && longDate(date)}{doctor ? ` · ${doctor.name}` : ''}{info && date === info.today ? ` · now ${info.now}` : ''}
              </div>

              {day && day.slots.length === 0 ? (
                <EmptyState icon={<CalendarCheck size={36} />} title="No times on this day">{day.note}</EmptyState>
              ) : (
                <div role="group" aria-label="Times" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8 }}>
                  {day?.slots.map((s) => {
                    const taken = s.state === 'booked';
                    const open = s.state === 'open';
                    const on = picked === s.time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={!open || !canWrite}
                        aria-pressed={on}
                        onClick={() => { setPicked(s.time); setErrors([]); setNotice(''); }}
                        className={'rx-chip' + (on ? ' rx-chip--selected' : '')}
                        style={{ flexDirection: 'column', justifyContent: 'center', gap: 0, minHeight: 56, opacity: open ? 1 : 0.75, cursor: open && canWrite ? 'pointer' : 'default', background: taken ? 'var(--rx-surface-2)' : undefined }}
                      >
                        <strong style={{ fontSize: 16 }}>{s.time}</strong>
                        <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {taken ? nameAt(s.time) ?? 'Booked' : open ? 'Free' : 'Too soon'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <section aria-label="The day's bookings" className="rx-stack" style={{ gap: 10 }}>
            <h2 style={{ margin: '4px 0 0', fontSize: 17 }}>{bookings.length === 0 ? 'No bookings yet for this day' : `${live.length} booked${bookings.length > live.length ? `, ${bookings.length - live.length} cancelled or missed` : ''}`}</h2>
            {info && bookings.map((b) => (
              <BookingRow key={`${b.id}-${b.status}-${b.time}`} b={b} info={info} canWrite={canWrite} onChanged={(m) => { setNotice(m ?? ''); refresh(); }} />
            ))}
          </section>
        </div>

        {canWrite && (
          <aside className="rx-split__side" aria-label="Book a time">
            <Card>
              {!picked || !slot ? (
                <EmptyState icon={<CalendarCheck size={32} />} title="Pick a free time">Choose a time on the left to book it.</EmptyState>
              ) : (
                <form onSubmit={book} className="rx-stack" style={{ gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 17 }}>Book {picked}</h2>
                    <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{longDate(date)} · {doctor?.name} · {slot.branchName} · {slot.minutes} min</span>
                  </div>

                  <SegmentedControl label="Who is the patient" value={who} onChange={setWho} options={[{ value: 'existing', label: 'Existing patient' }, { value: 'new', label: 'New patient' }]} />

                  {who === 'existing' ? (
                    <div className="rx-stack" style={{ gap: 8 }}>
                      <TextField label="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
                      <ul className="rx-recent" aria-label="Patients">
                        {shown.map((p) => (
                          <li key={p.id}>
                            <button type="button" className="rx-recent__btn" aria-current={patientId === p.id} onClick={() => setPatientId(p.id)}>
                              <strong>{p.full_name}</strong>
                              <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>{p.age}Y, {p.gender} · {p.phone}</span>
                            </button>
                          </li>
                        ))}
                        {shown.length === 0 && <li style={{ color: 'var(--rx-ink-2)', fontSize: 'var(--rx-fs-label)' }}>No match. Try “New patient”.</li>}
                      </ul>
                    </div>
                  ) : (
                    <div className="rx-stack" style={{ gap: 10 }}>
                      <TextField label="Full name" required value={np.fullName} onChange={(e) => setNp({ ...np, fullName: e.target.value })} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <TextField label="Age" suffix="years" type="number" required value={np.age} onChange={(e) => setNp({ ...np, age: e.target.value })} />
                        <Select label="Gender" value={np.gender} onChange={(e) => setNp({ ...np, gender: e.target.value })}>
                          <option>Female</option><option>Male</option><option>Other</option>
                        </Select>
                      </div>
                      <TextField label="Mobile number" type="tel" required value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
                    </div>
                  )}

                  <TextField label="What is it for? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Select label="How did they ask?" value={source} onChange={(e) => setSource(e.target.value)}>
                    {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>

                  {errors.length > 0 && <Callout tone="danger" title="This was not booked">{errors.join(' ')}</Callout>}
                  <Button type="submit" size="lg" disabled={busy || (who === 'existing' && patientId === '')}>
                    {busy ? 'Booking…' : `Book ${picked}`}
                  </Button>
                </form>
              )}
            </Card>
          </aside>
        )}
      </main>
    </div>
  );
};
