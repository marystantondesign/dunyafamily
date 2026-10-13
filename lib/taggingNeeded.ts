import { canRemove } from "./auth";
import { q } from "./db";
import type { Session } from "./session";

/** "Tagging needed": a photo with at least one person nobody has named yet, so the family can help. */

export async function setTaggingNeeded(photoId: number, on: boolean, s: Session) {
  if (on)
    await q(`update photos set tagging_needed = true, tagging_needed_by = $2, tagging_needed_by_device = $3, tagging_needed_at = now()
              where id = $1 and not tagging_needed`, [photoId, s.pid ?? null, s.did]);
  else await q(`update photos set tagging_needed = false where id = $1`, [photoId]);
}

/** Whoever flagged it, or the admin, can clear the flag from Edit details. */
export function canClearFlag(s: Session | null, flag: { by: number | null; byDevice: string | null }) {
  if (!s) return false;
  return s.role === "admin" || (!!flag.by && flag.by === s.pid) || canRemove(s, flag.byDevice);
}

export async function taggingNeededCount() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from photos where tagging_needed and deleted_at is null`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}
