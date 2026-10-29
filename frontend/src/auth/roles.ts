import type { Role } from './session';

/**
 * Which screens each role may open. This only decides what the screen shows: the server enforces the
 * real rules (BanglaRx.Api/Auth/RoleGuard.cs), so a hand-typed address still gets "your role can't do that".
 */
const FRONT: Role[] = ['doctor', 'assistant', 'receptionist', 'manager'];

const ROUTES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: '#/queue', roles: FRONT },
  { prefix: '#/register', roles: FRONT },
  { prefix: '#/bookings', roles: FRONT },
  { prefix: '#/dashboard', roles: ['manager'] },
  { prefix: '#/schedules', roles: ['manager'] },
  { prefix: '#/users', roles: ['manager'] },
  { prefix: '#/pharmacy', roles: ['pharmacist', 'manager'] },
  // the workbench is the home route: '', '#', '#/'
  { prefix: '#/', roles: ['doctor', 'assistant', 'manager'] },
];

export const LANDING: Record<Role, string> = {
  doctor: '#/',
  assistant: '#/',
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
  const h = hash === '' || hash === '#' ? '#/' : hash;
  const exact = h === '#/' ? ROUTES.find((r) => r.prefix === '#/') : ROUTES.find((r) => r.prefix !== '#/' && h.startsWith(r.prefix));
  return exact ? exact.roles.includes(role) : false;
}
