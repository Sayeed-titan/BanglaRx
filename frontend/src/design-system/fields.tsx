import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cx } from './utils';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  helper?: string;
  /** when set, replaces the helper and turns the field red */
  error?: string;
  /** a unit shown inside the field, like mmHg or kg */
  suffix?: string;
}

export function TextField({ label, helper, error, suffix, id, required, className, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  const note = error ?? helper;
  return (
    <div className={cx('rx-field', className)}>
      <label className="rx-field__label" htmlFor={inputId}>
        {label}
        {required && (
          <span className="rx-field__req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className={cx('rx-field__control', error && 'rx-field__control--error')}>
        <input
          id={inputId}
          className="rx-field__input"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...rest}
        />
        {suffix && <span className="rx-field__suffix">{suffix}</span>}
      </div>
      {note && (
        <span id={noteId} className={cx('rx-field__help', error && 'rx-field__help--error')}>
          {note}
        </span>
      )}
    </div>
  );
}
