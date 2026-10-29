import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cx } from './utils';

/* ---- AppBar: brand on the left, actions on the right, optional second row ---- */
export interface AppBarProps {
  brand: ReactNode;
  actions?: ReactNode;
  /** a quieter second row, for example the doctor and patient pickers */
  sub?: ReactNode;
}

export function AppBar({ brand, actions, sub }: AppBarProps) {
  return (
    <header className="rx-appbar no-print">
      <div className="rx-appbar__row">
        {brand}
        {actions && <div className="rx-row">{actions}</div>}
      </div>
      {sub && (
        <div className="rx-appbar__row--sub">
          <div className="rx-appbar__inner" style={{ padding: '8px 24px' }}>
            {sub}
          </div>
        </div>
      )}
    </header>
  );
}

/* ---- EmptyState --------------------------------------------------------------- */
export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rx-empty">
      {icon && <span className="rx-empty__icon">{icon}</span>}
      <strong className="rx-empty__title">{title}</strong>
      {children && <span className="rx-empty__text">{children}</span>}
    </div>
  );
}

/* ---- Select / Textarea with a real label ------------------------------------- */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  /** hide the label visually but keep it for screen readers */
  hideLabel?: boolean;
}

export function Select({ label, hideLabel, id, className, children, ...rest }: SelectProps) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className={cx('rx-field', className)}>
      <label htmlFor={sid} className={cx('rx-field__label', hideLabel && 'rx-visually-hidden')}>
        {label}
      </label>
      <select id={sid} className="rx-select" {...rest}>
        {children}
      </select>
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hideLabel?: boolean;
  helper?: string;
}

export function Textarea({ label, hideLabel, helper, id, className, ...rest }: TextareaProps) {
  const auto = useId();
  const tid = id ?? auto;
  return (
    <div className={cx('rx-field', className)}>
      <label htmlFor={tid} className={cx('rx-field__label', hideLabel && 'rx-visually-hidden')}>
        {label}
      </label>
      <textarea id={tid} className="rx-textarea" {...rest} />
      {helper && <span className="rx-field__help">{helper}</span>}
    </div>
  );
}

/* ---- PageHeader: back arrow, title, and page actions (queue, registration) ---- */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** where the back arrow goes, for example "#/" */
  backHref: string;
  backLabel: string;
  actions?: ReactNode;
  /** shows the pulsing "Live" marker for screens that update by themselves */
  live?: boolean;
}

export function PageHeader({ title, subtitle, backHref, backLabel, actions, live }: PageHeaderProps) {
  return (
    <header className="rx-pagebar no-print">
      <a href={backHref} className="rx-iconbtn" aria-label={backLabel}>
        <ChevronLeft size={24} />
      </a>
      <div className="rx-pagebar__title">
        <h1>{title}</h1>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <span className="rx-pagebar__spacer" />
      {live && <span className="rx-live">Live</span>}
      {actions}
    </header>
  );
}
