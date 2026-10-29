import React, { useEffect, useState } from 'react';
import { Button } from '../design-system';
import { LoginPage } from '../pages/LoginPage';
import { UsersPage } from '../pages/UsersPage';
import { fetchStatus, getSession, logout, refreshMe, useSession } from './session';
import type { AuthStatus } from './session';
import { PatientApp } from '../patient/PatientApp';
import { RubinaChat } from '../rubina/RubinaChat';
import { LANDING, ROLE_LABEL, canOpen } from './roles';

/** The small "who is signed in" pill. */
const AccountBar: React.FC = () => {
  const session = useSession();
  if (!session) return null;
  return (
    <div className="rx-account no-print">
      <div className="rx-account__who">
        <strong>{session.user.displayName}</strong>
        <span>{ROLE_LABEL[session.user.role]}</span>
      </div>
      <Button variant="text" onClick={() => (window.location.hash = '#/password')}>Password</Button>
      <Button variant="tonal" onClick={() => { logout(); window.location.hash = ''; }}>Sign out</Button>
    </div>
  );
};

/**
 * Sits around the whole app. When the server requires sign-in it shows setup or sign-in until you are
 * in, sends you to a screen your role may open, and shows who is signed in. When sign-in is switched
 * off it steps aside, so the app works exactly as it did before.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useSession();
  const [status, setStatus] = useState<AuthStatus | null | 'loading'>('loading');
  const [hash, setHash] = useState(window.location.hash);

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
  }, [session?.token]);

  // patients have their own sign-in (a phone code) and never see the staff gate
  if (hash.startsWith('#/patient')) return <PatientApp />;
  // Rubina is public: anyone may ask which doctor to see without signing in
  if (hash.startsWith('#/rubina')) return <RubinaChat />;

  if (status === 'loading') return <div className="rx-page" aria-busy="true" />;

  // null means the API could not be reached: let the app open and show its own "can't reach the server" notices
  const enforced = status?.enforced ?? false;
  const hasUsers = status?.hasUsers ?? true;
  const role = session?.user.role;
  const landing = role ? LANDING[role] : '#/';

  // after signing in, go to this role's own home, not whatever address the last person left behind
  const goHome = () => {
    const s = getSession();
    window.location.hash = enforced ? (s ? LANDING[s.user.role] : '') : '#/users';
  };

  let redirect: string | null = null;
  let view: React.ReactNode = null;

  if (hash.startsWith('#/login') || (enforced && !hasUsers)) {
    view = session && !session.mustChangePassword ? null : <LoginPage mode={!hasUsers ? 'setup' : 'login'} onDone={goHome} />;
    if (session && !session.mustChangePassword) redirect = landing;
  } else if (enforced && !session) {
    view = <LoginPage mode="login" onDone={goHome} />;
  } else if (session?.mustChangePassword) {
    view = <LoginPage mode="change" onDone={goHome} />;
  } else if (hash.startsWith('#/password') && session) {
    view = <LoginPage mode="change" onDone={() => (window.location.hash = landing)} />;
  } else if (hash.startsWith('#/users')) {
    if (!session) redirect = '#/login';
    else if (role !== 'manager') redirect = landing;
    else view = <UsersPage />;
  } else if (enforced && role && !canOpen(role, hash)) {
    redirect = landing;
  }

  return <GateView view={view} redirect={redirect}>{children}</GateView>;
};

const GateView: React.FC<{ view: React.ReactNode; redirect: string | null; children: React.ReactNode }> = ({ view, redirect, children }) => {
  useEffect(() => {
    if (redirect !== null) window.location.hash = redirect;
  }, [redirect]);

  if (redirect !== null) return <div className="rx-page" aria-busy="true" />;
  if (view) return <>{view}<AccountBar /></>;
  return <>{children}<AccountBar /></>;
};
