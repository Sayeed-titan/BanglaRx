/** The left menu shared by the back-office pages (overview, schedules, pharmacy). */
export const managerNav = (current: '#/dashboard' | '#/inbox' | '#/bookings' | '#/schedules' | '#/users' | '#/pharmacy' | '#/queue' | '#/') =>
  [
    { href: '#/dashboard', label: 'Overview' },
    { href: '#/bookings', label: 'Bookings' },
    { href: '#/inbox', label: 'Rubina inbox' },
    { href: '#/schedules', label: 'Doctors and schedules' },
    { href: '#/users', label: 'Users and access' },
    { href: '#/', label: 'Consultation workbench' },
    { href: '#/queue', label: "Today's queue" },
    { href: '#/pharmacy', label: 'Pharmacy' },
  ].map((i) => ({ ...i, current: i.href === current }));
