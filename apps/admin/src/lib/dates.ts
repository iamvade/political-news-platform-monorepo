import { isoToUbLocal } from './timezone';

/** Today's calendar date in Ulaanbaatar (`YYYY-MM-DD`), the default for date inputs. */
export function todayUb(): string {
  return isoToUbLocal(new Date().toISOString()).slice(0, 10);
}
