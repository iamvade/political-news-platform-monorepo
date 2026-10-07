const TIME_ZONE = 'Asia/Ulaanbaatar';

const dateTime = new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE });
const dateOnly = new Intl.DateTimeFormat('mn-MN', { dateStyle: 'medium', timeZone: 'UTC' });

/** ISO timestamp → local (Ulaanbaatar) date and time. */
export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTime.format(new Date(iso)) : '—';
}

/** `YYYY-MM-DD` calendar date (no time zone shift). */
export function formatDate(date: string | null | undefined): string {
  return date ? dateOnly.format(new Date(`${date}T00:00:00Z`)) : '—';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const mnt = new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 2 });

/** MNT decimal string (e.g. "125000000.00") → grouped number. Strings keep full precision (no float rounding). */
export function formatMnt(value: string | null | undefined): string {
  return value === null || value === undefined ? '—' : mnt.format(value as Intl.StringNumericLiteral);
}
