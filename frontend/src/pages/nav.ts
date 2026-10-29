/** The left menu shared by the back-office pages (overview, schedules, pharmacy). */
export const managerNav = (current: '#/dashboard' | '#/schedules' | '#/pharmacy' | '#/queue' | '#/') =>
  [
    { href: '#/dashboard', label: 'Overview' },
    { href: '#/schedules', label: 'Doctors and schedules' },
    { href: '#/', label: 'Consultation workbench' },
    { href: '#/queue', label: "Today's queue" },
    { href: '#/pharmacy', label: 'Pharmacy' },
  ].map((i) => ({ ...i, current: i.href === current }));
