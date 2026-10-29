/** The left menu shared by the back-office pages (overview, schedules, pharmacy). */
export const managerNav = (current: '#/dashboard' | '#/bookings' | '#/schedules' | '#/users' | '#/pharmacy' | '#/queue' | '#/') =>
  [
    { href: '#/dashboard', label: 'Overview' },
    { href: '#/bookings', label: 'Bookings' },
    { href: '#/schedules', label: 'Doctors and schedules' },
    { href: '#/users', label: 'Users and access' },
    { href: '#/', label: 'Consultation workbench' },
    { href: '#/queue', label: "Today's queue" },
    { href: '#/pharmacy', label: 'Pharmacy' },
  ].map((i) => ({ ...i, current: i.href === current }));
