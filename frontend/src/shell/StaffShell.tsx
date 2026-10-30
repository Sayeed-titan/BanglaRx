import React, { useEffect, useState } from 'react';
import { CalendarCheck, CalendarClock, ChevronsLeft, ChevronsRight, Headset, Home, KeyRound, LayoutDashboard, ListOrdered, LogOut, Menu, Pill, Stethoscope, UserPlus, Users, X } from 'lucide-react';
import { logout, useSession } from '../auth/session';
import { ROLE_LABEL, canOpen } from '../auth/roles';

const ITEMS = [
  { href: '#/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '#/workbench', label: 'Consultation workbench', icon: Stethoscope },
  { href: '#/queue', label: "Today's queue", icon: ListOrdered },
  { href: '#/register', label: 'New patient', icon: UserPlus },
  { href: '#/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '#/inbox', label: 'Rubina inbox', icon: Headset },
  { href: '#/pharmacy', label: 'Pharmacy', icon: Pill },
  { href: '#/schedules', label: 'Doctors and schedules', icon: CalendarClock },
  { href: '#/users', label: 'Users and access', icon: Users },
];

const KEY = 'banglarx.sidebar.collapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * The frame around every internal screen: a sidebar that only lists what the signed-in role may open, which collapses to
 * icons on a desktop (and is remembered), and slides in from a menu button on a phone.
 */
export const StaffShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const session = useSession();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const on = () => {
      setHash(window.location.hash);
      setOpen(false); // choosing a screen closes the phone menu
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* it is remembered for this visit only */
    }
  };

  const role = session?.user.role;
  const items = role ? ITEMS.filter((i) => canOpen(role, i.href)) : [];
  const initial = (session?.user.displayName || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="rx-staff" data-collapsed={collapsed} data-open={open}>
      <header className="rx-staff__top no-print">
        <button type="button" className="rx-staff__burger" aria-label="Open the menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu size={24} />
        </button>
        <div className="rx-brand">
          <div className="rx-brand__mark" aria-hidden="true"><Stethoscope size={22} /></div>
          <div className="rx-brand__name">BanglaRx</div>
        </div>
      </header>

      <div className="rx-staff__scrim no-print" onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className="rx-side no-print" aria-label="Main menu">
        <div className="rx-side__head">
          <a href="#/" className="rx-brand" title="Public home page" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="rx-brand__mark" aria-hidden="true"><Stethoscope size={24} /></div>
            <div className="rx-brand__name rx-side__label">BanglaRx</div>
          </a>
          <button type="button" className="rx-side__close" aria-label="Close the menu" onClick={() => setOpen(false)}>
            <X size={22} />
          </button>
        </div>

        <nav className="rx-side__nav" aria-label="Screens">
          {items.map((it) => {
            const on = hash.startsWith(it.href);
            const Icon = it.icon;
            return (
              <a key={it.href} href={it.href} title={it.label} aria-current={on ? 'page' : undefined} className={'rx-side__link' + (on ? ' rx-side__link--on' : '')}>
                <Icon size={20} aria-hidden="true" />
                <span className="rx-side__label">{it.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="rx-side__foot">
          <a href="#/" title="Public home page" className="rx-side__link">
            <Home size={20} aria-hidden="true" />
            <span className="rx-side__label">Public home page</span>
          </a>
          <button type="button" className="rx-side__link rx-side__collapse" onClick={toggle} aria-pressed={collapsed} title={collapsed ? 'Expand the menu' : 'Collapse the menu'}>
            {collapsed ? <ChevronsRight size={20} aria-hidden="true" /> : <ChevronsLeft size={20} aria-hidden="true" />}
            <span className="rx-side__label">{collapsed ? 'Expand' : 'Collapse'}</span>
          </button>
          {session && (
            <div className="rx-side__who">
              <div className="rx-side__avatar" aria-hidden="true">{initial}</div>
              <div className="rx-side__label rx-side__name">
                <strong>{session.user.displayName}</strong>
                <span>{ROLE_LABEL[session.user.role]}</span>
              </div>
            </div>
          )}
          <a href="#/password" title="Change password" className="rx-side__link">
            <KeyRound size={20} aria-hidden="true" />
            <span className="rx-side__label">Change password</span>
          </a>
          <button
            type="button"
            className="rx-side__link"
            title="Sign out"
            onClick={async () => {
              await logout();
              window.location.hash = '#/';
            }}
          >
            <LogOut size={20} aria-hidden="true" />
            <span className="rx-side__label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="rx-staff__main">{children}</div>
    </div>
  );
};
