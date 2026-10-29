import { useSyncExternalStore } from 'react';
import { API_BASE } from '../api';

export interface Profile {
  id: number;
  fullName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  patientUid: string;
  link: string;
}

export interface PatientSession {
  token: string;
  expiresAt: string;
  phone: string;
  profiles: Profile[];
}

/** A patient stays signed in on their own phone for the token's life (14 days) or until they sign out. */
const KEY = 'banglarx.patient';
let current: PatientSession | null = read();
const listeners = new Set<() => void>();

function read(): PatientSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PatientSession;
    return new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function publish(next: PatientSession | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the session will not survive a reload */
  }
  listeners.forEach((l) => l());
}

export function usePatientSession(): PatientSession | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export interface Reply<T> {
  ok: boolean;
  status: number;
  data: T | null;
  errors: string[];
}

/** Calls the patient API. Always sends the patient token explicitly, so a staff sign-in in the same browser is never used. */
export async function pcall<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Reply<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Authorization: current ? `Bearer ${current.token}` : 'Bearer none' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : ((await res.json().catch(() => null)) as (T & { errors?: string[] }) | null);
    if (res.status === 401 && current && path !== '/patient/auth/verify') publish(null);
    if (res.ok) return { ok: true, status: res.status, data, errors: [] };
    return { ok: false, status: res.status, data: null, errors: (data as { errors?: string[] } | null)?.errors ?? [`The server answered ${res.status}.`] };
  } catch {
    return { ok: false, status: 0, data: null, errors: ['NETWORK'] };
  }
}

export const requestCode = (phone: string) => pcall<{ sent: boolean; expiresInSeconds: number }>('POST', '/patient/auth/request-code', { phone });

export async function verifyCode(phone: string, code: string): Promise<Reply<PatientSession>> {
  const r = await pcall<PatientSession>('POST', '/patient/auth/verify', { phone, code });
  if (r.ok && r.data) publish(r.data);
  return r;
}

export function setProfiles(profiles: Profile[]) {
  if (current) publish({ ...current, profiles });
}

export async function signOut(): Promise<void> {
  await pcall('POST', '/patient/auth/logout');
  publish(null);
}
