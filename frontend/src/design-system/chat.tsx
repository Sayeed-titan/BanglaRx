import { useId } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Mic, Send } from 'lucide-react';
import { IconButton } from './actions';
import { cx } from './utils';

/* ---- MessageBubble ---------------------------------------------------------- */
export interface MessageBubbleProps {
  from: 'user' | 'assistant';
  /** small line under the bubble, for example a time or the sender name */
  meta?: ReactNode;
  /** shows a blinking caret while the answer is still arriving */
  streaming?: boolean;
  children: ReactNode;
}

export function MessageBubble({ from, meta, streaming, children }: MessageBubbleProps) {
  return (
    <div className={cx('rx-msg', `rx-msg--${from}`)}>
      <div className="rx-msg__bubble">
        {children}
        {streaming && <span className="rx-caret" aria-hidden="true" />}
      </div>
      {meta && <span className="rx-msg__meta">{meta}</span>}
    </div>
  );
}

/* ---- TypingDots ------------------------------------------------------------- */
export function TypingDots({ label = 'Assistant is typing' }: { label?: string }) {
  return (
    <span className="rx-typing" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}

/* ---- Composer: one text box, a mic, and send ------------------------------- */
export interface ComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSend: (text: string) => void;
  /** omit to hide the mic */
  onMic?: () => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function Composer({ value, onChange, onSend, onMic, placeholder = 'Ask in Bangla or English…', label = 'Message', disabled }: ComposerProps) {
  const id = useId();
  const canSend = value.trim().length > 0 && !disabled;
  const send = () => {
    if (canSend) onSend(value.trim());
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
  return (
    <div className="rx-composer">
      <label htmlFor={id} className="rx-visually-hidden">
        {label}
      </label>
      <input
        id={id}
        className="rx-composer__input"
        type="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
      />
      {onMic && (
        <IconButton aria-label="Speak your message" onClick={onMic}>
          <Mic size={22} />
        </IconButton>
      )}
      <IconButton aria-label="Send message" variant="filled" onClick={send} disabled={!canSend}>
        <Send size={22} />
      </IconButton>
    </div>
  );
}
