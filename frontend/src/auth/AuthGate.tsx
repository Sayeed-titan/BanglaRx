import React, { useEffect, useState } from 'react';
import { Button, Callout } from '../design-system';
import { LoginPage } from '../pages/LoginPage';
import { UsersPage } from '../pages/UsersPage';
import { fetchStatus, getSession, refreshMe, useSession } from './session';
import type { AuthStatus } from './session';
import { PatientApp } from '../patient/PatientApp';
import { RubinaChat } from '../rubina/RubinaChat';
import { Landing } from '../landing/Landing';
import { StaffShell } from '../shell/StaffShell';
import { LANDING, canOpen } from './roles';

/** The public front door: the address with nothing after it, or #/welcome. */
const isLanding = (h: string) => h === '' || h === '#' || h === '#/' || h.startsWith('#/welcome');

/**
 * Sits around the whole app and decides who sees what.
 *  - Public: the landing page, Rubina (#/rubina), the patient app (#/patient, its own phone-code sign-in), and the staff sign-in.
 *  - Everything else is internal. Without a staff sign-in none of it opens: you are sent to the sign-in page.
 *  - With a sign-in, you only reach the screens your role allows, inside the sidebar shell.
 * The server enforces the same rules (BanglaRx.Api/Auth/RoleGuard.cs) when Auth:Enforce is on; this gate makes the screens match.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useSession();
  const [status, setStatus] = useState<AuthStatus | null | 'loading'>('loading');
  const [hash, setHash] = useState(window.location.hash);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // learn the server's rules, and confirm the saved session is still alive
  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await fetchStatus();
      await refreshMe();
      if (alive) setStatus(s);
    })();
    return () => {
      alive = false;
    };
  }, [session?.token, retry]);

  // public screens: no staff sign-in needed
  if (hash.startsWith('#/patient')) return <PatientApp />;
  if (hash.startsWith('#/rubina')) return <RubinaChat />;
  if (isLanding(hash)) return <Landing />;

  if (status === 'loading') return <div className="rx-page" aria-busy="true" />;

  // the server could not be reached: say so, instead of showing a screen that cannot work
  if (status === null) {
    return (
      <div className="rx-page" style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
        <Callout tone="attention" title="Can't reach the server">
          Start the BanglaRx API, then try again.
        </Callout>
        <div className="rx-row" style={{ gap: 8, marginTop: 12 }}>
          <Button onClick={() => { setStatus('loading'); setRetry((n) => n + 1); }}>Try again</Button>
          <Button variant="text" onClick={() => (window.location.hash = '#/')}>Back to the home page</Button>
        </div>
      </div>
    );
  }

  const hasUsers = status.hasUsers;
  const role = session?.user.role;
  const home = role ? LANDING[role] : '#/login';
  const goHome = () => {
    const s = getSession();
    window.location.hash = s ? LANDING[s.user.role] : '#/login';
  };

  let redirect: string | null = null;
  let view: React.ReactNode = null;
  let inShell = true;

  if (!hasUsers) {
    // nobody has an account yet: the first person sets up the manager account
    view = <LoginPage mode="setup" onDone={goHome} />;
    inShell = false;
  } else if (hash.startsWith('#/login')) {
    inShell = false;
    if (session && !session.mustChangePassword) redirect = home;
    else view = session ? <LoginPage mode="change" onDone={goHome} /> : <LoginPage mode="login" onDone={goHome} />;
  } else if (!session) {
    redirect = '#/login'; // every other screen is internal
  } else if (session.mustChangePassword) {
    inShell = false;
    view = <LoginPage mode="change" onDone={goHome} />;
  } else if (hash.startsWith('#/password')) {
    view = <LoginPage mode="change" onDone={() => (window.location.hash = home)} />;
  } else if (!role || !canOpen(role, hash)) {
    redirect = home;
  } else if (hash.startsWith('#/users')) {
    view = <UsersPage />;
  }

  return <GateView view={view} redirect={redirect} inShell={inShell}>{children}</GateView>;
};

const GateView: React.FC<{ view: React.ReactNode; redirect: string | null; inShell: boolean; children: React.ReactNode }> = ({ view, redirect, inShell, children }) => {
  useEffect(() => {
    if (redirect !== null) window.location.hash = redirect;
  }, [redirect]);

  if (redirect !== null) return <div className="rx-page" aria-busy="true" />;
  const body = view ?? children;
  return inShell ? <StaffShell>{body}</StaffShell> : <>{body}</>;
};
