import { Mic, Square } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './utils';

/** Animated bars shown while the microphone is live. Purely decorative. */
export function Equalizer() {
  return (
    <div className="rx-eq" aria-hidden="true">
      {[0.05, 0.25, 0.45, 0.15, 0.35, 0.55].map((d) => (
        <span key={d} className="equalizer-bar" style={{ animationDelay: `${d}s` }} />
      ))}
    </div>
  );
}

export interface MicPodProps {
  listening: boolean;
  onToggle: () => void;
  /** amend: the doctor is changing an existing prescription, not dictating a new one */
  mode?: 'new' | 'amend';
  /** line of guidance under the button */
  text: ReactNode;
}

/** The big microphone. One tap starts, one tap stops. */
export function MicPod({ listening, onToggle, mode = 'new', text }: MicPodProps) {
  return (
    <div className={cx('rx-micpod', listening && 'rx-micpod--live', !listening && mode === 'amend' && 'rx-micpod--amend')}>
      <button
        type="button"
        className={cx('rx-mic', listening && 'rx-mic--live', !listening && mode === 'amend' && 'rx-mic--amend')}
        onClick={onToggle}
        aria-pressed={listening}
        aria-label={listening ? 'Stop listening' : 'Start listening'}
      >
        {listening ? <Square size={26} fill="currentColor" /> : <Mic size={30} />}
      </button>
      <span className="rx-micpod__text">{text}</span>
      {listening && <Equalizer />}
    </div>
  );
}
