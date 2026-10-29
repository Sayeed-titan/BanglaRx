import { useCallback, useState } from 'react';

export interface UiPrefs {
  theme: 'light' | 'dark';
  text: 'normal' | 'large';
}

const KEY = 'banglarx.ui.prefs';
const DEFAULTS: UiPrefs = { theme: 'light', text: 'normal' };

function read(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      theme: p.theme === 'dark' ? 'dark' : 'light',
      text: p.text === 'large' ? 'large' : 'normal',
    };
  } catch {
    return DEFAULTS;
  }
}

/** Writes the choice onto <body>, where tokens.css reads it. Printing ignores dark mode. */
export function applyPrefs(p: UiPrefs): void {
  document.body.setAttribute('data-theme', p.theme);
  document.body.setAttribute('data-text', p.text);
}

/** Call once before the first render so there is no flash of the wrong theme. */
export function initPrefs(): void {
  applyPrefs(read());
}

export function usePrefs(): { prefs: UiPrefs; setTheme: (t: UiPrefs['theme']) => void; setText: (t: UiPrefs['text']) => void } {
  const [prefs, setPrefs] = useState<UiPrefs>(read);
  const update = useCallback((next: UiPrefs) => {
    setPrefs(next);
    applyPrefs(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* private mode: the choice just will not persist */
    }
  }, []);
  return {
    prefs,
    setTheme: (theme) => update({ ...prefs, theme }),
    setText: (text) => update({ ...prefs, text }),
  };
}
