import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { cx } from './utils';

export type Tone = 'neutral' | 'primary' | 'success' | 'attention' | 'danger' | 'info';

/* ---- Badge: status always travels with a word, never colour alone ---------- */
export interface BadgeProps {
  tone?: Tone | 'outline';
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={cx('rx-badge', tone !== 'neutral' && `rx-badge--${tone}`)}>
      {icon}
      {children}
    </span>
  );
}

/* ---- Callout --------------------------------------------------------------- */
export interface CalloutProps {
  tone: 'danger' | 'info' | 'success' | 'attention';
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
}

const CALLOUT_ICON = {
  danger: <ShieldAlert size={22} />,
  info: <Info size={22} />,
  success: <CheckCircle2 size={22} />,
  attention: <AlertTriangle size={22} />,
} as const;

export function Callout({ tone, title, children, icon }: CalloutProps) {
  return (
    <div className={cx('rx-callout', `rx-callout--${tone}`)} role={tone === 'danger' ? 'alert' : 'note'}>
      <span className="rx-callout__icon" aria-hidden="true">
        {icon ?? CALLOUT_ICON[tone]}
      </span>
      <div className="rx-callout__body">
        {title && <strong className="rx-callout__title">{title}</strong>}
        {children && <span className="rx-callout__text">{children}</span>}
      </div>
    </div>
  );
}

/* ---- Card ------------------------------------------------------------------ */
export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  flush?: boolean;
  active?: boolean;
}

export function Card({ as: Tag = 'section', flush, active, className, ...rest }: CardProps) {
  return <Tag className={cx('rx-card', flush && 'rx-card--flush', active && 'rx-card--active', className)} {...rest} />;
}

/* ---- StatTile -------------------------------------------------------------- */
export interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'neutral' | 'primary' | 'attention';
}

export function StatTile({ label, value, hint, tone = 'neutral' }: StatTileProps) {
  return (
    <div className={cx('rx-stat', tone !== 'neutral' && `rx-stat--${tone}`)}>
      <span className="rx-stat__label">{label}</span>
      <strong className="rx-stat__value">{value}</strong>
      {hint && <span className="rx-stat__hint">{hint}</span>}
    </div>
  );
}

/* ---- Avatar, TokenBadge ---------------------------------------------------- */
export function Avatar({ initials, tone = 'accent' }: { initials: string; tone?: 'accent' | 'primary' }) {
  return (
    <span className={cx('rx-avatar', tone === 'primary' && 'rx-avatar--primary')} aria-hidden="true">
      {initials}
    </span>
  );
}

export function TokenBadge({ number, state = 'waiting' }: { number: number | string; state?: 'waiting' | 'active' | 'done' }) {
  return (
    <span className={cx('rx-token', state === 'active' && 'rx-token--active', state === 'done' && 'rx-token--done')} aria-label={`Token ${number}`}>
      {number}
    </span>
  );
}
