const ROWS = [
  {
    initials: 'AP',
    name: 'Andi Pratama',
    service: 'Haircut and Beard Trim',
    time: '09:00',
    status: 'completed',
    label: 'Completed',
  },
  {
    initials: 'SR',
    name: 'Siti Rahmawati',
    service: 'Grey Blending',
    time: '10:00',
    status: 'booked',
    label: 'Booked',
  },
  {
    initials: 'DS',
    name: 'Dimas Saputra',
    service: 'Hot Towel Shave',
    time: '11:30',
    status: 'no_show',
    label: 'No-show',
  },
  {
    initials: 'PL',
    name: 'Putri Lestari',
    service: 'Hair Coloring',
    time: '13:00',
    status: 'booked',
    label: 'Booked',
  },
];

const NAV = ['Appointments', 'Services', 'Business hours', 'Closures'];

/** The staff dashboard, drawn with the app's own status colours and demo data. */
export function TrustBoard() {
  return (
    <div
      className="board"
      role="img"
      aria-label="The Slotwise staff dashboard: today’s appointments with their times and status"
    >
      <div className="board__side" aria-hidden="true">
        <p className="board__brand">slotwise</p>
        <ul>
          {NAV.map((item, index) => (
            <li key={item} className={index === 0 ? 'is-current' : undefined}>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="board__main" aria-hidden="true">
        <div className="board__title">
          <p>Today’s appointments</p>
          <span>Thu, 6 Nov</span>
        </div>
        <ul className="board__rows">
          {ROWS.map((row) => (
            <li key={row.name}>
              <span className="board__avatar">{row.initials}</span>
              <span className="board__who">
                <strong>{row.name}</strong>
                {row.service}
              </span>
              <span className="board__time">{row.time}</span>
              <span className={`status-pill status-pill--${row.status}`}>{row.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
