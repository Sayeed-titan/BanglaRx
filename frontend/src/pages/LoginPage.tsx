import React, { useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { Button, Callout, TextField } from '../design-system';
import { changePassword, login, setupFirstManager } from '../auth/session';

type Mode = 'login' | 'setup' | 'change';

const COPY: Record<Mode, { title: string; lead: string; button: string }> = {
  login: { title: 'Sign in', lead: 'Use the username and password your manager gave you.', button: 'Sign in' },
  setup: { title: 'Set up BanglaRx', lead: 'Nobody has an account yet. Whoever sets up becomes the manager and can then add everyone else.', button: 'Create the manager account' },
  change: { title: 'Choose your own password', lead: 'The password you were given is temporary. Choose one only you know.', button: 'Save my password' },
};

/**
 * Sign-in, first-time setup and the forced password change share this layout (the canvas "Sign in" page).
 * Your role comes from your account, never from a choice on this screen.
 */
export const LoginPage: React.FC<{ mode: Mode; onDone?: () => void }> = ({ mode, onDone }) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [again, setAgain] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const copy = COPY[mode];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    if ((mode === 'setup' && password !== again) || (mode === 'change' && newPassword !== again)) {
      setErrors(['The two passwords are not the same.']);
      return;
    }
    setBusy(true);
    const problems =
      mode === 'login' ? await login(username, password) : mode === 'setup' ? await setupFirstManager(username, displayName, password) : await changePassword(password, newPassword);
    setBusy(false);
    if (problems.length > 0) setErrors(problems);
    else onDone?.();
  };

  return (
    <div className="rx-login">
      <aside className="rx-login__brand">
        <div className="rx-brand">
          <div className="rx-brand__mark" aria-hidden="true">
            <Stethoscope size={26} />
          </div>
          <span className="rx-brand__name">BanglaRx AI</span>
        </div>
        <div>
          <h1 className="rx-login__tagline rx-bn">কথা বলুন।<br />প্রেসক্রিপশন তৈরি।</h1>
          <p style={{ margin: '16px 0 0', fontSize: 18, lineHeight: 1.6, maxWidth: 400, opacity: 0.92 }}>
            One platform for the doctor, the front desk, the pharmacy and the manager. The AI drafts. People decide.
          </p>
        </div>
        <span style={{ fontSize: 'var(--rx-fs-label)', opacity: 0.85 }}>Health data stays protected. Every sign-in is logged.</span>
      </aside>

      <main className="rx-login__form">
        <div>
          <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.01em' }}>{copy.title}</h2>
          <p style={{ margin: '6px 0 0', fontSize: 16, color: 'var(--rx-ink-2)', lineHeight: 1.5 }}>{copy.lead}</p>
        </div>

        <form onSubmit={submit} className="rx-stack" style={{ maxWidth: 460 }}>
          {mode !== 'change' && (
            <TextField label="Username" required autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          )}
          {mode === 'setup' && <TextField label="Your name" required autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />}
          <TextField
            label={mode === 'change' ? 'Temporary password' : 'Password'}
            type="password"
            required
            autoComplete={mode === 'login' ? 'current-password' : mode === 'change' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helper={mode === 'setup' ? 'At least 10 characters. A few random words is a good password.' : undefined}
          />
          {mode === 'change' && (
            <TextField label="New password" type="password" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} helper="At least 10 characters." />
          )}
          {mode !== 'login' && (
            <TextField label="Type it again" type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          )}

          {errors.length > 0 && (
            <Callout tone="danger" title={mode === 'login' ? "Couldn't sign you in" : 'This was not saved'}>
              {errors.join(' ')}
            </Callout>
          )}

          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'One moment…' : copy.button}
          </Button>
        </form>

        {mode === 'login' && (
          <div style={{ maxWidth: 460, paddingTop: 16, borderTop: '1px solid var(--rx-outline)', fontSize: 'var(--rx-fs-label)', lineHeight: 1.55, color: 'var(--rx-ink-2)' }}>
            <strong style={{ color: 'var(--rx-ink)' }}>Are you a patient?</strong>
            <br />
            Patients use the BanglaRx patient app. Staff accounts are made by your manager.
          </div>
        )}
      </main>
    </div>
  );
};
