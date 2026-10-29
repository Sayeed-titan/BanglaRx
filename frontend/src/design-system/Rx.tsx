import type { HTMLAttributes } from 'react';
import './system.css';
import { cx } from './utils';

export interface RxProps extends HTMLAttributes<HTMLDivElement> {
  theme?: 'light' | 'dark';
  /** patient: big and calm, clinic: default, compact: tables and dashboards */
  density?: 'patient' | 'clinic' | 'compact';
  /** the A+ switch */
  text?: 'normal' | 'large';
}

/** Root wrapper. Everything in the design system must sit inside one of these. */
export function Rx({ theme = 'light', density = 'clinic', text = 'normal', className, ...rest }: RxProps) {
  return <div className={cx('rx', className)} data-theme={theme} data-density={density} data-text={text} {...rest} />;
}
