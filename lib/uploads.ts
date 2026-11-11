import { isAdmin } from "./auth";
import { q } from "./db";
import type { Session } from "./session";

/** Phone photos (not scans of old prints): 30 a day per profile. The admin has no limit. Days turn over at the family's midnight. */
export const DAILY_LIMIT = 30;

export async function phoneUploadsToday(pid: number) {
  const [r] = await q<{ n: number }>(
    `select count(*)::int as n from photos
      where uploaded_by_person = $1 and not coalesce(from_scan, false)
        and created_at >= (date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York')`, [pid]);
  return r?.n ?? 0;
}

/** How many phone photos this person can still add today, or null for no limit. */
export async function phoneUploadsLeft(s: Session | null): Promise<number | null> {
  if (!s || isAdmin(s)) return null;
  if (!s.pid) return 0;
  return Math.max(0, DAILY_LIMIT - (await phoneUploadsToday(s.pid)));
}
