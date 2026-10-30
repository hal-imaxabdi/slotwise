export function formatIdr(amount: number): string {
  const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${grouped}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  if (rest === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${rest} min`;
}

const LONG_DATE = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// Formats a plain calendar date ("2026-10-29") without any timezone shift.
export function formatLongDate(isoDate: string): string {
  return LONG_DATE.format(new Date(`${isoDate}T00:00:00Z`));
}

// Plain calendar-date arithmetic on "YYYY-MM-DD" strings, done in UTC so the
// browser's local time zone can never shift the result.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SHORT_WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const SHORT_DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export function formatWeekdayShort(isoDate: string): string {
  return SHORT_WEEKDAY.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatDayMonthShort(isoDate: string): string {
  return SHORT_DAY_MONTH.format(new Date(`${isoDate}T00:00:00Z`));
}
