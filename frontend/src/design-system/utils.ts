export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Shown wherever a clinical value was never captured. Never guess, never zero. */
export const NOT_RECORDED = 'Not recorded';
