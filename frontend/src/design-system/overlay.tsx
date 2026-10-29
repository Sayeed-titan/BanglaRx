import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './actions';
import { cx } from './utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** centred dialog sizes, or a side drawer from the right */
  size?: 'sm' | 'md' | 'lg' | 'drawer';
  footer?: ReactNode;
  children: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible dialog: Esc closes, Tab stays inside, focus returns to what opened it. */
export function Modal({ open, onClose, title, subtitle, icon, size = 'md', footer, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => before?.focus?.();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const drawer = size === 'drawer';
  return (
    <div className={cx('rx-scrim no-print', drawer && 'rx-scrim--right')} onClick={onClose}>
      <div
        ref={ref}
        className={cx('rx-dialog', drawer ? 'rx-dialog--right' : `rx-dialog--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rx-dialog__head">
          {icon}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} className="rx-dialog__title">
              {title}
            </h2>
            {subtitle && <div className="rx-dialog__sub">{subtitle}</div>}
          </div>
          <IconButton aria-label="Close" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="rx-dialog__body">{children}</div>
        {footer && <div className="rx-dialog__foot">{footer}</div>}
      </div>
    </div>
  );
}
