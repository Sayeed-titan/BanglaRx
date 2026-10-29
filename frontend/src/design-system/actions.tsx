import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './utils';

/* ---- Button ---------------------------------------------------------------- */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger' | 'attention';
  size?: 'md' | 'lg';
  icon?: ReactNode;
  fullWidth?: boolean;
}

export function Button({ variant = 'filled', size = 'md', icon, fullWidth, className, type = 'button', children, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('rx-btn', `rx-btn--${variant}`, size === 'lg' && 'rx-btn--lg', fullWidth && 'rx-btn--full', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---- LinkButton: a link that looks like a button. Use it to move between pages. ---- */
export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  icon?: ReactNode;
}

export function LinkButton({ variant = 'filled', size = 'md', icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <a className={cx('rx-btn', `rx-btn--${variant}`, size === 'lg' && 'rx-btn--lg', className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}

/* ---- IconButton: the label is required, an icon alone says nothing to a screen reader */
export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  'aria-label': string;
  variant?: 'standard' | 'filled' | 'tonal' | 'danger';
}

export function IconButton({ variant = 'standard', className, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button type={type} className={cx('rx-iconbtn', variant !== 'standard' && `rx-iconbtn--${variant}`, className)} {...rest}>
      {children}
    </button>
  );
}

/* ---- Chip ------------------------------------------------------------------ */
export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  /** when given, the chip is a button (a suggestion or filter). Otherwise it is a plain label. */
  onClick?: () => void;
  icon?: ReactNode;
  className?: string;
}

export function Chip({ children, selected, onClick, icon, className }: ChipProps) {
  const cls = cx('rx-chip', selected && 'rx-chip--selected', className);
  if (onClick) {
    return (
      <button type="button" className={cls} aria-pressed={selected ?? false} onClick={onClick}>
        {icon}
        {children}
      </button>
    );
  }
  return (
    <span className={cls}>
      {icon}
      {children}
    </span>
  );
}

/* ---- Switch ---------------------------------------------------------------- */
export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="rx-switch" onClick={() => onChange(!checked)} />;
}

/* ---- SegmentedControl ------------------------------------------------------ */
export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  label: string;
}

export function SegmentedControl<T extends string>({ value, onChange, options, label }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="rx-seg">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className="rx-seg__opt" onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
