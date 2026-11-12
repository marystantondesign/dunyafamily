import { q } from "./db";
import { displayName } from "./names";
import { signGet } from "./r2";
import type { Session } from "./session";

/**
 * Photo removal requests. Someone asks, from their own profile, about photos tagged with them:
 * remove (at least 400 characters of reasons), untag, or upsetting (also hidden from them right away).
 * "Keep" sends nothing. Mary decides on the Removal requests page; the requester isn't told.
 */
export type RemovalKind = "remove" | "untag" | "upset";
export const MIN_REASON = 400;
export const KIND_LABEL: Record<RemovalKind, string> = {
  remove: "Please remove this photo.",
  untag: "Just remove my tag from this photo.",
  upset: "It’s not personal, but this photo is upsetting to me.",
};

export type RemovalAnswer = { photoId: number; kind: RemovalKind | "keep"; note?: string };

/** Saves one person's answers. Returns how many requests went to Mary, or what's wrong. */
export async function sendRemovals(s: Session, answers: RemovalAnswer[]): Promise<number | string> {
  if (!s.pid) return "Pick yourself first.";
  const asks = answers.filter((a) => a.kind !== "keep").slice(0, 200);
  for (const a of asks) {
    if (!["remove", "untag", "upset"].includes(a.kind)) return "Something about that request didn't look right.";
    if (a.kind === "remove" && (a.note ?? "").trim().length < MIN_REASON) return `Write at least ${MIN_REASON} characters about why.`;
  }
  if (!asks.length) return 0;
  // Only photos actually tagged with this person.
  const ids = asks.map((a) => Number(a.photoId));
  const tagged = new Set((await q<{ photo_id: number }>(
    `select x.photo_id from photo_people x join photos p on p.id = x.photo_id and p.deleted_at is null
      where x.person_id = $1 and x.photo_id = any($2::int[])`, [s.pid, ids])).map((r) => r.photo_id));
  let sent = 0;
  for (const a of asks) {
    const pid = Number(a.photoId);
    if (!tagged.has(pid)) continue;
    const note = (a.note ?? "").trim().slice(0, 10_000) || null;
    // A newer request about the same photo replaces one Mary hasn't decided yet.
    await q(`update photo_removal_requests set status = 'replaced', decided_at = now() where photo_id = $1 and person_id = $2 and status = 'pending'`, [pid, s.pid]);
    await q(`insert into photo_removal_requests (photo_id, person_id, kind, note) values ($1, $2, $3, $4)`, [pid, s.pid, a.kind, note]);
    if (a.kind === "upset") await q(`insert into photo_hidden (person_id, photo_id) values ($1, $2) on conflict do nothing`, [s.pid, pid]);
    sent++;
  }
  return sent;
}

export async function pendingRemovalCount() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from photo_removal_requests where status = 'pending'`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

/** Mary's queue: waiting requests first (oldest first), then the last 50 she decided. */
export async function removalQueue() {
  const rows = await q<{
    id: number; photo_id: number; kind: RemovalKind; note: string | null; status: string; created_at: string; decided_at: string | null;
    name: string; thumb_key: string | null; photo_gone: boolean;
  }>(
    `(select r.id, r.photo_id, r.kind, r.note, r.status, r.created_at, r.decided_at, pe.name, p.thumb_key, p.deleted_at is not null as photo_gone
        from photo_removal_requests r join people pe on pe.id = r.person_id join photos p on p.id = r.photo_id
       where r.status = 'pending' order by r.created_at)
     union all
     (select r.id, r.photo_id, r.kind, r.note, r.status, r.created_at, r.decided_at, pe.name, p.thumb_key, p.deleted_at is not null
        from photo_removal_requests r join people pe on pe.id = r.person_id join photos p on p.id = r.photo_id
       where r.status in ('removed', 'untagged', 'kept') order by r.decided_at desc limit 50)`).catch(() => []);
  return Promise.all(rows.map(async (r) => ({
    id: r.id, photoId: r.photo_id, kind: r.kind, label: KIND_LABEL[r.kind] ?? r.kind, note: r.note, status: r.status,
    at: new Date(r.created_at).toISOString(), decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
    name: displayName(r.name), url: r.thumb_key ? await signGet(r.thumb_key) : null, photoGone: r.photo_gone,
  })));
}

/** Mary decides: remove the photo (soft delete, restorable from Recently deleted), remove the tag, or keep it. */
export async function decideRemoval(id: number, action: "remove" | "untag" | "keep", s: Session): Promise<string | null> {
  const [r] = await q<{ photo_id: number; person_id: number; status: string }>(`select photo_id, person_id, status from photo_removal_requests where id = $1`, [id]);
  if (!r) return "That request isn't here anymore.";
  if (r.status !== "pending") return "That request was already decided.";
  if (action === "remove") await q(`update photos set deleted_at = now(), deleted_by_name = $2 where id = $1 and deleted_at is null`, [r.photo_id, s.name]);
  if (action === "untag") await q(`delete from photo_people where photo_id = $1 and person_id = $2`, [r.photo_id, r.person_id]);
  const status = action === "remove" ? "removed" : action === "untag" ? "untagged" : "kept";
  await q(`update photo_removal_requests set status = $2, decided_at = now(), decided_by_name = $3 where id = $1`, [id, status, s.name]);
  // A removed photo settles every other request about it.
  if (action === "remove")
    await q(`update photo_removal_requests set status = 'removed', decided_at = now(), decided_by_name = $2 where photo_id = $1 and status = 'pending'`, [r.photo_id, s.name]);
  return null;
}
