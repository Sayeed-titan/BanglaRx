import type { Role } from './session';

/**
 * Which screens each role may open. This only decides what the screen shows: the server enforces the
 * real rules (BanglaRx.Api/Auth/RoleGuard.cs), so a hand-typed address still gets "your role can't do that".
 * Every internal screen is listed here; an address that is not listed opens nothing.
 */
const FRONT: Role[] = ['doctor', 'assistant', 'receptionist', 'manager'];

const ROUTES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '#/workbench', roles: ['doctor', 'assistant', 'manager'] },
  { prefix: '#/queue', roles: FRONT },
  { prefix: '#/register', roles: FRONT },
  { prefix: '#/bookings', roles: FRONT },
  { prefix: '#/inbox', roles: ['receptionist', 'manager'] },
  { prefix: '#/dashboard', roles: ['manager'] },
  { prefix: '#/schedules', roles: ['manager'] },
  { prefix: '#/users', roles: ['manager'] },
  { prefix: '#/pharmacy', roles: ['pharmacist', 'manager'] },
];

export const LANDING: Record<Role, string> = {
  doctor: '#/workbench',
  assistant: '#/workbench',
  receptionist: '#/queue',
  pharmacist: '#/pharmacy',
  manager: '#/dashboard',
};

export const ROLE_LABEL: Record<Role, string> = {
  doctor: 'Doctor',
  assistant: 'Assistant',
  receptionist: 'Receptionist',
  pharmacist: 'Pharmacist',
  manager: 'Manager',
};

export function canOpen(role: Role, hash: string): boolean {
  const row = ROUTES.find((r) => hash.startsWith(r.prefix));
  return row ? row.roles.includes(role) : false;
}
