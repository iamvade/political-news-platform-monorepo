/**
 * Ulaanbaatar wall-clock time ↔ UTC for `<input type="datetime-local">` (value format `YYYY-MM-DDTHH:mm`).
 * The offset comes from Intl's tz database, not a hardcoded +08:00, so history (Mongolia had DST in
 * 2015–2016) and any future rule change are handled.
 */
export const UB_TIME_ZONE = 'Asia/Ulaanbaatar';

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: UB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function wallClock(date: Date) {
  const map = Object.fromEntries(parts.formatToParts(date).map((p) => [p.type, p.value]));
  return { year: map.year!, month: map.month!, day: map.day!, hour: map.hour!, minute: map.minute! };
}

/** Offset of Ulaanbaatar from UTC at `epochMs`, in ms (e.g. +8h). */
function offsetAt(epochMs: number): number {
  const minute = Math.floor(epochMs / 60_000) * 60_000;
  const w = wallClock(new Date(minute));
  return Date.UTC(+w.year, +w.month - 1, +w.day, +w.hour, +w.minute) - minute;
}

/** ISO instant → `YYYY-MM-DDTHH:mm` in Ulaanbaatar time ('' for null). */
export function isoToUbLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const w = wallClock(new Date(iso));
  return `${w.year}-${w.month}-${w.day}T${w.hour}:${w.minute}`;
}

const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `YYYY-MM-DDTHH:mm` read as Ulaanbaatar time → UTC ISO string, or null if the value is not a valid time. */
export function ubLocalToIso(local: string): string | null {
  const match = LOCAL_PATTERN.exec(local);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(asUtc) || new Date(asUtc).getUTCDate() !== d) return null; // e.g. 2026-02-31
  // Two passes settle the offset around a rule change.
  let epoch = asUtc - offsetAt(asUtc);
  epoch = asUtc - offsetAt(epoch);
  return new Date(epoch).toISOString();
}

const timeOnly = new Intl.DateTimeFormat('mn-MN', { timeStyle: 'short', timeZone: UB_TIME_ZONE });

/** `HH:mm` in Ulaanbaatar time (save status line). */
export function formatUbTime(date: Date): string {
  return timeOnly.format(date);
}
