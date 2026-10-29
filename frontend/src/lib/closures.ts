const JAKARTA_OFFSET = '+07:00'; // Asia/Jakarta has no DST

/** Jakarta-local date (YYYY-MM-DD) plus minutes after midnight (0-1440) to a UTC ISO string. */
export function jakartaToUtcIso(date: string, minuteOfDay: number): string {
  const midnight = Date.parse(`${date}T00:00:00${JAKARTA_OFFSET}`);
  return new Date(midnight + minuteOfDay * 60_000).toISOString();
}

/** Minutes after midnight (0-1440) as HH:MM; 1440 shows as 24:00. */
export function formatMinute(minute: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}
