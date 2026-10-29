/**
 * The local API. App.tsx keeps its own copy of this constant; new pages import it from here.
 * Set VITE_API_BASE to point a dev server at another API (the full-stack tests do this).
 */
export const API_BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000/api';

/** GET json. Throws when the server is unreachable or answers with an error, so pages can show a clear message. */
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export interface SendResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** plain-language problems from the server (validation), or a connection message */
  errors: string[];
}

/** POST / PUT json. Never throws: the page gets { ok, errors } and can show them next to the form. */
export async function sendJson<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<SendResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'DELETE' ? undefined : JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as (T & { errors?: string[]; Errors?: string[] }) | null;
    if (res.ok) return { ok: true, status: res.status, data, errors: [] };
    return { ok: false, status: res.status, data: null, errors: data?.errors ?? data?.Errors ?? [`The server answered ${res.status}.`] };
  } catch {
    return { ok: false, status: 0, data: null, errors: ["Can't reach the server. Is the API running?"] };
  }
}
