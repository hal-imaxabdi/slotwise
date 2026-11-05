const ROWS = [
  { time: '09:00', name: 'Andi Pratama', service: 'Classic Haircut', state: 'Completed' },
  { time: '09:30', name: 'Siti Rahmawati', service: 'Grey Blending', state: 'Completed' },
  { time: '10:30', name: 'Rizky Hidayat', service: 'Beard Trim and Shape', state: 'Booked' },
  { time: '11:00', name: 'Walk-in: Dimas S.', service: 'Haircut and Beard Trim', state: 'Booked' },
  { time: '13:00', name: 'Fajar Nugroho', service: 'Hot Towel Shave', state: 'No-show' },
] as const;

/** A static, to-scale picture of the staff day-book as it looks in the app. */
export function StaffPreview() {
  return (
    <figure className="app-preview">
      <div className="app-preview__bar" aria-hidden="true">
        <span className="app-preview__brand">Slotwise</span>
        <span className="app-preview__tab">Services</span>
        <span className="app-preview__tab is-current">Staff</span>
        <span className="app-preview__tab">Closures</span>
      </div>
      <div className="app-preview__body">
        <p className="app-preview__title" aria-hidden="true">Thursday</p>
        <ol className="app-preview__rows">
          {ROWS.map((row) => (
            <li key={row.time}>
              <span className="app-preview__time">{row.time}</span>
              <span className="app-preview__who">
                <strong>{row.name}</strong>
                <span>{row.service}</span>
              </span>
              <span className={`app-preview__state app-preview__state--${row.state.toLowerCase()}`}>
                {row.state}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="visually-hidden">
        The staff day-book: each visit in time order with the client, the service and its status.
      </figcaption>
    </figure>
  );
}
