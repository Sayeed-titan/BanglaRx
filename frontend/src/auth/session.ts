import { useSyncExternalStore } from 'react';
import { API_BASE } from '../api';

export type Role = 'doctor' | 'assistant' | 'receptionist' | 'pharmacist' | 'manager';

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  doctorId?: number;
}

export interface Session {
  token: string;
  expiresAt: string;
  user: SessionUser;
  mustChangePassword: boolean;
}

export interface AuthStatus {
  enforced: boolean;
  hasUsers: boolean;
}

const KEY = 'banglarx.session';
/** The one API address the whole app uses (see api.ts). The token is never sent anywhere else. */
const API_BASES = [API_BASE];

// ---- the session lives in this browser tab only (sessionStorage): closing the tab signs out ----
let current: Session | null = readStored();
const listeners = new Set<() => void>();

function readStored(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return current;
}

function publish(next: Session | null) {
  current = next;
  try {
    if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* private mode: the session simply will not survive a reload */
  }
  listeners.forEach((l) => l());
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

/**
 * Puts the token on every call to the BanglaRx API, so each screen (including the older ones that call
 * fetch directly) is signed in without being changed. A 401 while signed in means the server ended the
 * session (signed out elsewhere, switched off, expired): the session is cleared and the gate shows sign-in.
 */
export function installAuthFetch(): void {
  const w = window as unknown as { __rxAuthFetch?: boolean };
  if (w.__rxAuthFetch) return;
  w.__rxAuthFetch = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!API_BASES.some((b) => url.startsWith(b))) return original(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    // only a call that carried the staff token may end the staff session (the patient app sends its own Authorization header)
    const token = headers.has('Authorization') ? undefined : current?.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await original(input, { ...init, headers });
    if (res.status === 401 && token && !/\/auth\/(login|setup)/.test(url)) publish(null);
    return res;
  };
}

// ---- calls ----------------------------------------------------------------------------------------

interface Result<T> {
  ok: boolean;
  data: T | null;
  errors: string[];
}

async function post<T>(path: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as (T & { errors?: string[] }) | null;
    if (res.ok) return { ok: true, data, errors: [] };
    return { ok: false, data: null, errors: data?.errors ?? [`The server answered ${res.status}.`] };
  } catch {
    return { ok: false, data: null, errors: ["Can't reach the server. Is the API running?"] };
  }
}

export async function fetchStatus(): Promise<AuthStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/status`);
    return res.ok ? ((await res.json()) as AuthStatus) : null;
  } catch {
    return null;
  }
}

/** Asks the server who this token belongs to. A dead token is cleared by the fetch patch above. */
export async function refreshMe(): Promise<void> {
  if (!current) return;
  try {
    const res = await fetch(`${API_BASE}/auth/me`);
    if (res.ok) {
      const me = (await res.json()) as { user: SessionUser; mustChangePassword: boolean };
      publish({ ...current, user: me.user, mustChangePassword: me.mustChangePassword });
    }
  } catch {
    /* offline: keep what we have */
  }
}

export async function login(username: string, password: string): Promise<string[]> {
  const r = await post<Session>('/auth/login', { username, password });
  if (r.ok && r.data) publish(r.data);
  return r.errors;
}

export async function setupFirstManager(username: string, displayName: string, password: string): Promise<string[]> {
  const r = await post<Session>('/auth/setup', { username, displayName, password });
  if (r.ok && r.data) publish(r.data);
  return r.errors;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<string[]> {
  const r = await post<Session>('/auth/change-password', { currentPassword, newPassword });
  if (r.ok && r.data) publish(r.data);
  return r.errors;
}

/** Ends the session on the server too (every token of this account stops working), then clears it here. */
export async function logout(): Promise<void> {
  await post('/auth/logout').catch(() => undefined);
  publish(null);
}
