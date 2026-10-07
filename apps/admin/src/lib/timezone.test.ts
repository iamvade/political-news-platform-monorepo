import { describe, expect, it } from 'vitest';
import { isoToUbLocal, ubLocalToIso } from './timezone';

describe('Ulaanbaatar time ↔ UTC', () => {
  it.each([
    ['2026-10-07T09:30', '2026-10-07T01:30:00.000Z'],
    // Before 08:00 UB the UTC date is the previous day.
    ['2026-10-08T03:15', '2026-10-07T19:15:00.000Z'],
    ['2027-01-01T00:00', '2026-12-31T16:00:00.000Z'],
    // Summer time 2016 (UTC+9).
    ['2016-07-01T12:00', '2016-07-01T03:00:00.000Z'],
  ])('%s UB → %s', (local, iso) => {
    expect(ubLocalToIso(local)).toBe(iso);
    expect(isoToUbLocal(iso)).toBe(local);
  });

  it('round-trips any minute', () => {
    const iso = '2026-03-15T22:45:00.000Z';
    expect(ubLocalToIso(isoToUbLocal(iso))).toBe(iso);
  });

  it('rejects malformed or impossible values', () => {
    expect(ubLocalToIso('')).toBeNull();
    expect(ubLocalToIso('2026-10-07 09:30')).toBeNull();
    expect(ubLocalToIso('2026-02-31T10:00')).toBeNull();
    expect(isoToUbLocal(null)).toBe('');
  });
});
