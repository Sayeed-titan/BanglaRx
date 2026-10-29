import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState, IconButton, NavRail, Select, Switch, TextField } from '../design-system';
import { getJson, sendJson } from '../api';
import { managerNav } from './nav';

interface Session {
  id: number;
  branchId: number;
  branchName: string;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

interface DoctorSchedule {
  doctor: {
    id: number;
    name: string;
    specialization: string;
    roomNo?: string;
    hospitalName?: string;
    consultationFee?: number;
    acceptsOnlineBooking: boolean;
    onLeaveUntil?: string;
  };
  sessions: Session[];
}

interface Branch {
  id: number;
  name: string;
  is_active: boolean;
}

/** A session while it is being edited. `key` only exists so React can track rows. */
interface DraftSession {
  key: number;
  branchId: number;
  weekday: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
}

interface Draft {
  fee: string;
  online: boolean;
  leave: string;
  sessions: DraftSession[];
}

/** Bangladesh week order, Saturday first. weekday numbers match the server: 0 = Sunday ... 6 = Saturday. */
const WEEK: Array<{ day: number; short: string; long: string }> = [
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 0, short: 'Sun', long: 'Sunday' },
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
];
const SLOT_CHOICES = [5, 10, 12, 15, 20, 30, 45, 60];

let keySeed = 1;
const toDraft = (d: DoctorSchedule): Draft => ({
  fee: d.doctor.consultationFee != null ? String(d.doctor.consultationFee) : '',
  online: d.doctor.acceptsOnlineBooking,
  leave: d.doctor.onLeaveUntil ?? '',
  sessions: d.sessions.map((s) => ({ key: keySeed++, branchId: s.branchId, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, slotMinutes: s.slotMinutes })),
});
const sameDraft = (a: Draft, b: Draft) => JSON.stringify({ ...a, sessions: a.sessions.map(({ key: _k, ...r }) => r) }) === JSON.stringify({ ...b, sessions: b.sessions.map(({ key: _k, ...r }) => r) });

/** Doctors, branches and weekly sessions. Everything shown and saved here lives in the database. */
export const SchedulesPage: React.FC = () => {
  const [data, setData] = useState<DoctorSchedule[] | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  const [branchError, setBranchError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([getJson<DoctorSchedule[]>('/schedules'), getJson<Branch[]>('/branches')]);
      setData(s);
      setBranches(b.filter((x) => x.is_active));
      setLoadError(false);
      return s;
    } catch {
      setLoadError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    load().then((s) => {
      if (s && s.length > 0) {
        setSelectedId(s[0].doctor.id);
        setDraft(toDraft(s[0]));
      }
    });
  }, [load]);

  const current = data?.find((d) => d.doctor.id === selectedId) ?? null;
  const original = useMemo(() => (current ? toDraft(current) : null), [current]);
  const dirty = !!(draft && original && !sameDraft(draft, original));

  const choose = (d: DoctorSchedule) => {
    if (dirty && !window.confirm('You have unsaved changes for this doctor. Switch anyway?')) return;
    setSelectedId(d.doctor.id);
    setDraft(toDraft(d));
    setErrors([]);
    setSaved(false);
  };

  const patch = (p: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    setSaved(false);
  };
  const patchSession = (key: number, p: Partial<DraftSession>) => patch({ sessions: draft!.sessions.map((s) => (s.key === key ? { ...s, ...p } : s)) });
  const addSession = () =>
    patch({
      sessions: [...draft!.sessions, { key: keySeed++, branchId: branches[0]?.id ?? 0, weekday: 6, startTime: '16:00', endTime: '20:00', slotMinutes: 10 }],
    });

  const save = async () => {
    if (!draft || !current) return;
    setSaving(true);
    setErrors([]);
    const res = await sendJson<DoctorSchedule>('PUT', `/doctors/${current.doctor.id}/schedule`, {
      consultationFee: draft.fee.trim() === '' ? null : Number(draft.fee),
      acceptsOnlineBooking: draft.online,
      onLeaveUntil: draft.leave || null,
      sessions: draft.sessions.map(({ key: _k, ...s }) => s),
    });
    setSaving(false);
    if (!res.ok || !res.data) {
      setErrors(res.errors);
      return;
    }
    const fresh = res.data;
    setData((all) => (all ? all.map((d) => (d.doctor.id === fresh.doctor.id ? fresh : d)) : all));
    setDraft(toDraft(fresh));
    setSaved(true);
  };

  const addBranch = async () => {
    setBranchError('');
    const res = await sendJson<{ id: number }>('POST', '/branches', { name: newBranch });
    if (!res.ok) {
      setBranchError(res.errors.join(' '));
      return;
    }
    setNewBranch('');
    await load();
  };

  return (
    <div className="rx-page">
      <div className="rx-shell">
        <NavRail label="Manager" items={managerNav('#/schedules')} />

        <main className="rx-shell__main">
          <header>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.01em' }}>Doctors and schedules</h1>
            <span style={{ fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)' }}>Patients can only book the sessions set here</span>
          </header>

          {loadError && (
            <Callout tone="attention" title="Can't reach the server">
              Start the BanglaRx API, then reload this page.
            </Callout>
          )}

          {data && data.length === 0 && <EmptyState title="No doctors yet">Add a doctor from the workbench's chamber setup first.</EmptyState>}

          <div className="rx-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <section aria-label="Doctors" className="rx-stack" style={{ flex: '999 1 520px', minWidth: 0, gap: 10 }}>
              <div className="rx-row" style={{ gap: 6, paddingLeft: 66, paddingRight: 18, flexWrap: 'nowrap' }} aria-hidden="true">
                {WEEK.map((w) => (
                  <span key={w.day} style={{ flex: 1, textAlign: 'center', fontSize: 'var(--rx-fs-caption)', fontWeight: 600, color: 'var(--rx-ink-2)' }}>{w.short}</span>
                ))}
              </div>

              {(data ?? []).map((d) => {
                const active = d.doctor.id === selectedId;
                const onLeave = d.doctor.onLeaveUntil && new Date(d.doctor.onLeaveUntil) >= new Date(new Date().toDateString());
                return (
                  <button
                    key={d.doctor.id}
                    type="button"
                    onClick={() => choose(d)}
                    aria-pressed={active}
                    className="rx-card"
                    style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', borderWidth: active ? 2 : 1, borderColor: active ? 'var(--rx-primary)' : undefined, display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 18px' }}
                  >
                    <span className="rx-row" style={{ flexWrap: 'nowrap', gap: 12 }}>
                      <span className="rx-avatar" aria-hidden="true">{d.doctor.name.split(' ').filter((p) => /^[A-Za-z]/.test(p)).slice(-2).map((p) => p[0]).join('').toUpperCase() || 'Dr'}</span>
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                        <strong style={{ fontSize: 16 }}>{d.doctor.name}</strong>
                        <span style={{ display: 'block', fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
                          {d.doctor.specialization}{d.doctor.roomNo ? ` · ${d.doctor.roomNo}` : ''}
                        </span>
                      </span>
                      {onLeave ? <Badge tone="attention">On leave to {d.doctor.onLeaveUntil}</Badge> : d.sessions.length === 0 ? <Badge>No schedule set</Badge> : <Badge tone="success">{d.doctor.acceptsOnlineBooking ? 'Bookable online' : 'Active'}</Badge>}
                    </span>
                    <span className="rx-row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'stretch' }}>
                      {WEEK.map((w) => {
                        const todays = d.sessions.filter((s) => s.weekday === w.day);
                        return (
                          <span
                            key={w.day}
                            aria-label={`${w.long}: ${todays.length ? todays.map((s) => `${s.startTime} to ${s.endTime}`).join(', ') : 'off'}`}
                            style={{ flex: 1, minWidth: 0, borderRadius: 10, padding: '6px 2px', textAlign: 'center', fontSize: 'var(--rx-fs-caption)', lineHeight: 1.35, fontWeight: todays.length ? 600 : 500, background: todays.length ? 'var(--rx-primary-container)' : 'var(--rx-surface-2)', color: todays.length ? 'var(--rx-on-primary-container)' : 'var(--rx-ink-3)' }}
                          >
                            {todays.length ? todays.map((s) => <span key={s.id} style={{ display: 'block' }}>{s.startTime}<br />{s.endTime}</span>) : 'Off'}
                          </span>
                        );
                      })}
                    </span>
                  </button>
                );
              })}
            </section>

            {draft && current && (
              <aside aria-label={`Edit ${current.doctor.name}`} style={{ flex: '1 1 340px', maxWidth: 460, minWidth: 0 }}>
                <Card>
                  <div className="rx-stack" style={{ gap: 14 }}>
                    <h2 style={{ margin: 0, fontSize: 17 }}>{current.doctor.name}</h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                      <TextField label="Visit fee" suffix="BDT" type="number" min={0} value={draft.fee} onChange={(e) => patch({ fee: e.target.value })} helper="Leave blank if not set" />
                      <TextField label="On leave until" type="date" value={draft.leave} onChange={(e) => patch({ leave: e.target.value })} helper="Blank means working" />
                    </div>

                    <div className="rx-row" style={{ flexWrap: 'nowrap', gap: 12 }}>
                      <Switch label="Patients can book online" checked={draft.online} onChange={(online) => patch({ online })} />
                      <span style={{ fontSize: 'var(--rx-fs-label)', lineHeight: 1.4 }}>
                        <strong>Patients can book online</strong>
                        <span style={{ display: 'block', color: 'var(--rx-ink-2)', fontSize: 'var(--rx-fs-caption)' }}>The booking assistant offers only the sessions below.</span>
                      </span>
                    </div>

                    <div className="rx-section-label">Weekly sessions</div>
                    {draft.sessions.length === 0 && <p style={{ margin: 0, color: 'var(--rx-ink-2)', fontSize: 'var(--rx-fs-label)' }}>No sessions yet. Without a session nobody can book this doctor.</p>}

                    {draft.sessions.map((s, i) => (
                      <fieldset key={s.key} style={{ margin: 0, padding: 12, border: '1px solid var(--rx-outline)', borderRadius: 'var(--rx-r-md)', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                        <legend style={{ padding: '0 6px', fontSize: 'var(--rx-fs-caption)', fontWeight: 700, color: 'var(--rx-ink-2)' }}>Session {i + 1}</legend>
                        <Select label="Day" value={s.weekday} onChange={(e) => patchSession(s.key, { weekday: Number(e.target.value) })}>
                          {WEEK.map((w) => <option key={w.day} value={w.day}>{w.long}</option>)}
                        </Select>
                        <Select label="Branch" value={s.branchId} onChange={(e) => patchSession(s.key, { branchId: Number(e.target.value) })}>
                          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                        <TextField label="From" type="time" value={s.startTime} onChange={(e) => patchSession(s.key, { startTime: e.target.value })} />
                        <TextField label="To" type="time" value={s.endTime} onChange={(e) => patchSession(s.key, { endTime: e.target.value })} />
                        <Select label="Minutes per patient" value={s.slotMinutes} onChange={(e) => patchSession(s.key, { slotMinutes: Number(e.target.value) })}>
                          {SLOT_CHOICES.map((m) => <option key={m} value={m}>{m} minutes</option>)}
                        </Select>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                          <IconButton aria-label={`Remove session ${i + 1}`} onClick={() => patch({ sessions: draft.sessions.filter((x) => x.key !== s.key) })}>
                            <Trash2 size={20} />
                          </IconButton>
                        </div>
                      </fieldset>
                    ))}

                    <Button variant="outlined" icon={<Plus size={18} />} onClick={addSession} disabled={branches.length === 0}>
                      Add a session
                    </Button>
                    {branches.length === 0 && <span style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>Add a branch first.</span>}

                    {errors.length > 0 && (
                      <Callout tone="danger" title="This was not saved">
                        {errors.join(' ')}
                      </Callout>
                    )}

                    <div className="rx-row" style={{ gap: 10 }}>
                      <Button size="lg" onClick={save} disabled={saving || !dirty} style={{ flex: 1 }}>
                        {saving ? 'Saving…' : 'Save changes'}
                      </Button>
                      {saved && !dirty && <Badge tone="success">Saved</Badge>}
                    </div>
                  </div>
                </Card>

                <Card style={{ marginTop: 16 }}>
                  <div className="rx-stack" style={{ gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 17 }}>Branches</h2>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--rx-fs-label)', lineHeight: 1.7 }}>
                      {branches.map((b) => <li key={b.id}>{b.name}</li>)}
                    </ul>
                    <TextField label="New branch name" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} error={branchError || undefined} />
                    <Button variant="tonal" onClick={addBranch} disabled={!newBranch.trim()}>Add branch</Button>
                  </div>
                </Card>
              </aside>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
