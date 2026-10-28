const JAKARTA_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const JAKARTA_DATE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jakarta',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const CHANGE_NOTICE_MS = 24 * 60 * 60 * 1000;

export function todayInJakarta(now: Date = new Date()): string {
  const parts = JAKARTA_DATE.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function jakartaParts(iso: string): { date: string; time: string } {
  const parts = JAKARTA_DATE_TIME.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function formatAppointmentRange(startsAt: string, endsAt: string): string {
  const start = jakartaParts(startsAt);
  const end = jakartaParts(endsAt);
  if (start.date === end.date) {
    return `${start.date}, ${start.time}-${end.time}`;
  }
  return `${start.date}, ${start.time} - ${end.date}, ${end.time}`;
}

// Client-side hint only: the server decides whether a change is allowed.
export function canChangeAppointment(startsAt: string, now: Date = new Date()): boolean {
  return Date.parse(startsAt) - now.getTime() >= CHANGE_NOTICE_MS;
}
