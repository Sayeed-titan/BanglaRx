import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Badge, Button, Callout, Card, EmptyState, Select, TextField } from '../design-system';
import { getJson, sendJson } from '../api';
import { fetchStatus, getSession } from '../auth/session';
import { ROLE_LABEL } from '../auth/roles';
import type { Role } from '../auth/session';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  doctor_id?: number;
  doctor_name?: string;
  is_active: boolean;
  must_change_password: boolean;
  is_locked: boolean;
  last_login_at?: string;
}

interface DoctorRow {
  id: number;
  name: string;
}

interface AuthEvent {
  id: number;
  at: string;
  username?: string;
  event: string;
  detail?: string;
}

const ROLES: Role[] = ['doctor', 'assistant', 'receptionist', 'pharmacist', 'manager'];
const needsDoctor = (r: string) => r === 'doctor' || r === 'assistant';
const EVENT_TEXT: Record<string, string> = {
  setup: 'Set up the first manager',
  login: 'Signed in',
  login_failed: 'Wrong password or unknown user',
  login_blocked: 'Blocked: account locked',
  locked: 'Account locked after wrong passwords',
  logout: 'Signed out',
  user_created: 'Account created',
  user_changed: 'Account changed',
  password_changed: 'Changed own password',
  password_reset: 'Password reset by a manager',
  password_change_failed: 'Password change failed',
};

function UserCard({ u, doctors, isMe, onChanged }: { u: UserRow; doctors: DoctorRow[]; isMe: boolean; onChanged: () => void }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'reset'>('view');
  const [role, setRole] = useState<Role>(u.role);
  const [doctorId, setDoctorId] = useState<number | ''>(u.doctor_id ?? '');
  const [temp, setTemp] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const done = async (res: { ok: boolean; errors: string[] }) => {
    setBusy(false);
    if (!res.ok) return setErrors(res.errors);
    setErrors([]);
    setMode('view');
    setTemp('');
    onChanged();
  };

  return (
    <Card style={{ padding: '14px 18px' }}>
      <div className="rx-stack" style={{ gap: 10 }}>
        <div className="rx-row" style={{ flexWrap: 'nowrap', gap: 12 }}>
          <span className="rx-avatar" aria-hidden="true">{u.display_name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</span>
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
            <strong style={{ fontSize: 16 }}>{u.display_name}{isMe ? ' (you)' : ''}</strong>
            <div style={{ fontSize: 'var(--rx-fs-caption)', color: 'var(--rx-ink-2)' }}>
              {u.username}{u.doctor_name ? ` · for ${u.doctor_name}` : ''} · {u.last_login_at ? `last signed in ${new Date(u.last_login_at).toLocaleString('en-GB')}` : 'never signed in'}
            </div>
          </div>
          <div className="rx-row" style={{ gap: 6, justifyContent: 'flex-end' }}>
            <Badge tone="primary">{ROLE_LABEL[u.role]}</Badge>
            {!u.is_active && <Badge tone="danger">Switched off</Badge>}
            {u.is_locked && <Badge tone="attention">Locked</Badge>}
            {u.must_change_password && <Badge tone="info">Temporary password</Badge>}
          </div>
        </div>

        {mode === 'view' && (
          <div className="rx-row" style={{ gap: 8 }}>
            <Button variant="outlined" onClick={() => setMode('edit')}>Change role</Button>
            <Button variant="outlined" onClick={() => setMode('reset')}>Reset password</Button>
            {!isMe && (
              <Button
                variant={u.is_active ? 'text' : 'tonal'}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  done(await sendJson('PUT', `/users/${u.id}`, { isActive: !u.is_active }));
                }}
              >
                {u.is_active ? 'Switch off' : 'Switch on'}
              </Button>
            )}
          </div>
        )}

        {mode === 'edit' && (
          <div className="rx-row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <Select label="Role" value={role} disabled={isMe} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
            {needsDoctor(role) && (
              <Select label="Works for" value={doctorId} onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">Choose a doctor</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            )}
            <Button disabled={busy} onClick={async () => { setBusy(true); done(await sendJson('PUT', `/users/${u.id}`, { role, doctorId: needsDoctor(role) ? doctorId || null : null })); }}>Save</Button>
            <Button variant="text" onClick={() => { setMode('view'); setErrors([]); }}>Cancel</Button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="rx-row" style={{ alignItems: 'flex-end', gap: 12 }}>
            <TextField label="Temporary password" type="password" autoComplete="new-password" value={temp} onChange={(e) => setTemp(e.target.value)} helper="They must choose their own at the next sign-in." />
            <Button disabled={busy || !temp} onClick={async () => { setBusy(true); done(await sendJson('POST', `/users/${u.id}/reset-password`, { password: temp })); }}>Reset</Button>
            <Button variant="text" onClick={() => { setMode('view'); setErrors([]); setTemp(''); }}>Cancel</Button>
          </div>
        )}

        {errors.length > 0 && <Callout tone="danger" title="This was not saved">{errors.join(' ')}</Callout>}
      </div>
    </Card>
  );
}

/** Accounts and roles. Manager only; the server refuses everyone else. */
export const UsersPage: React.FC = () => {
  const me = getSession()?.user;
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [enforced, setEnforced] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('receptionist');
  const [doctorId, setDoctorId] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [made, setMade] = useState('');

  const load = useCallback(async () => {
    try {
      const [u, d, e] = await Promise.all([getJson<UserRow[]>('/users'), getJson<DoctorRow[]>('/doctors'), getJson<AuthEvent[]>('/auth/events')]);
      setUsers(u);
      setDoctors(d);
      setEvents(e.slice(0, 15));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    load();
    fetchStatus().then((s) => setEnforced(s?.enforced ?? null));
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setMade('');
    const res = await sendJson('POST', '/users', { username, displayName, role, doctorId: needsDoctor(role) ? doctorId || null : null, password });
    if (!res.ok) return setErrors(res.errors);
    setMade(`${displayName} can now sign in as ${username} with the temporary password you typed. They will be asked to choose their own.`);
    setUsername('');
    setDisplayName('');
    setPassword('');
    load();
  };

  return (
    <div className="rx-page">
      <div className="rx-shell">
        <main className="rx-shell__main">
          <header>
            <h1 style={{ margin: 0, fontSize: 26, letterSpacing: '-0.01em' }}>Users and access</h1>
            <span style={{ fontSize: 'var(--rx-fs-label)', color: 'var(--rx-ink-2)' }}>Who can sign in, and what each person is allowed to do</span>
          </header>

          {enforced === false && (
            <Callout tone="attention" title="Sign-in is not required yet">
              Accounts work, but anyone can still open the app without one. To require sign-in, set Auth:Enforce to true in appsettings.local.json and restart the API.
            </Callout>
          )}
          {loadError && <Callout tone="attention" title="Can't load users">Start the BanglaRx API and sign in as a manager, then reload.</Callout>}

          <div className="rx-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <section aria-label="Accounts" className="rx-stack" style={{ flex: '999 1 520px', minWidth: 0, gap: 10 }}>
              {users && users.length === 0 && <EmptyState title="No accounts yet" />}
              {(users ?? []).map((u) => (
                <UserCard key={u.id + u.role + u.is_active} u={u} doctors={doctors} isMe={u.id === me?.id} onChanged={load} />
              ))}

              <Card>
                <div className="rx-stack" style={{ gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 17 }}>Sign-in log</h2>
                  {events.length === 0 && <span style={{ color: 'var(--rx-ink-2)' }}>Nothing yet.</span>}
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {events.map((ev) => (
                      <li key={ev.id} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 'var(--rx-fs-label)', padding: '6px 0', borderBottom: '1px solid var(--rx-outline)' }}>
                        <span style={{ color: 'var(--rx-ink-2)', minWidth: 150 }}>{new Date(ev.at).toLocaleString('en-GB')}</span>
                        <strong>{EVENT_TEXT[ev.event] ?? ev.event}</strong>
                        <span style={{ color: 'var(--rx-ink-2)' }}>{ev.username ?? ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </section>

            <aside aria-label="Add an account" style={{ flex: '1 1 340px', maxWidth: 460, minWidth: 0 }}>
              <Card>
                <form onSubmit={create} className="rx-stack" style={{ gap: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 17 }}>Add a person</h2>
                  <TextField label="Username" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} helper="Letters, numbers, dots. For example rubina.reception" />
                  <TextField label="Their name" required autoComplete="off" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>
                  {needsDoctor(role) && (
                    <Select label={role === 'doctor' ? 'Which doctor is this' : 'Which doctor do they assist'} value={doctorId} onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')} required>
                      <option value="">Choose a doctor</option>
                      {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                  )}
                  <TextField label="Temporary password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} helper="At least 10 characters. Tell them in person. They must choose their own at first sign-in." />
                  {errors.length > 0 && <Callout tone="danger" title="This was not saved">{errors.join(' ')}</Callout>}
                  {made && <Callout tone="success" title="Account created">{made}</Callout>}
                  <Button type="submit" size="lg" icon={<UserPlus size={20} />}>Create account</Button>
                </form>
              </Card>
              <Card style={{ marginTop: 16 }}>
                <div className="rx-stack" style={{ gap: 6, fontSize: 'var(--rx-fs-label)', lineHeight: 1.6 }}>
                  <strong>What each role can do</strong>
                  <span><b>Doctor:</b> their own queue and prescriptions; signs prescriptions.</span>
                  <span><b>Assistant:</b> works in one doctor's chamber; cannot sign.</span>
                  <span><b>Receptionist:</b> registers patients and runs the queue.</span>
                  <span><b>Pharmacist:</b> sees signed prescriptions only, with no diagnosis.</span>
                  <span><b>Manager:</b> overview, schedules, users.</span>
                </div>
              </Card>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};
