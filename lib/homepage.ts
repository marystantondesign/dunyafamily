import { q } from "./db";
import { signGet } from "./r2";
import type { Session } from "./session";

export const MAX_SPOTS = 10;
export const SPEEDS = [3, 4, 5, 6, 8, 10, 15];

export type HomepageItem = { photoId: number; caption: string; url: string };

/** The chosen homepage photos in order, and the speed. */
export async function homepageList(): Promise<{ items: HomepageItem[]; seconds: number }> {
  const [rows, speed] = await Promise.all([
    q<{ photo_id: number; caption: string | null; thumb_key: string }>(
      `select h.photo_id, h.caption, p.thumb_key from homepage_photos h join photos p on p.id = h.photo_id and p.deleted_at is null
        order by h.position, h.created_at`),
    q<{ value: string | null }>(`select value from settings where key = 'homepage_interval'`),
  ]);
  return {
    items: await Promise.all(rows.map(async (r) => ({ photoId: r.photo_id, caption: r.caption ?? "", url: await signGet(r.thumb_key) }))),
    seconds: Number(speed[0]?.value) || 6,
  };
}

/** How many spots are taken by photos still on the site. */
export async function spotsUsed() {
  const [row] = await q<{ n: number }>(`select count(*)::int as n from homepage_photos h join photos p on p.id = h.photo_id and p.deleted_at is null`);
  return row?.n ?? 0;
}

/** This photo's place on the homepage, if it has one. */
export async function homepageEntry(photoId: number) {
  const [row] = await q<{ caption: string | null }>(`select caption from homepage_photos where photo_id = $1`, [photoId]);
  return row ? { caption: row.caption ?? "" } : null;
}

const cleanCaption = (c: unknown) => String(c ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** Add photos at the end, as many as there are open spots. Returns how many went on. */
export async function addHomepagePhotos(ids: number[], s: Session, caption?: string) {
  const open = MAX_SPOTS - (await spotsUsed());
  // Photos that left the site free up their spot; take them off the list so they don't come back if restored.
  await q(`delete from homepage_photos h using photos p where p.id = h.photo_id and p.deleted_at is not null`);
  const fresh = (await q<{ id: number }>(
    `select p.id from photos p where p.id = any($1::int[]) and p.deleted_at is null
       and not exists (select 1 from homepage_photos h where h.photo_id = p.id)`, [ids])).map((r) => r.id);
  const keep = ids.filter((id) => fresh.includes(id)).slice(0, Math.max(0, open));
  const [{ max }] = await q<{ max: number }>(`select coalesce(max(position), -1)::int as max from homepage_photos`);
  for (const [i, id] of keep.entries())
    await q(`insert into homepage_photos (photo_id, caption, position, created_by_device) values ($1, $2, $3, $4) on conflict do nothing`,
      [id, caption !== undefined ? cleanCaption(caption) || null : null, max + 1 + i, s.did]);
  return keep.length;
}

export async function setHomepageCaption(photoId: number, caption: unknown) {
  await q(`update homepage_photos set caption = $1 where photo_id = $2`, [cleanCaption(caption) || null, photoId]);
}

export async function removeHomepagePhoto(photoId: number) {
  await q(`delete from homepage_photos where photo_id = $1`, [photoId]);
}

export async function orderHomepagePhotos(ids: number[]) {
  for (const [i, id] of ids.entries()) await q(`update homepage_photos set position = $1 where photo_id = $2`, [i, id]);
}

export async function setHomepageSpeed(seconds: number) {
  const s = SPEEDS.includes(seconds) ? seconds : 6;
  await q(`insert into settings (key, value, updated_at) values ('homepage_interval', $1, now())
           on conflict (key) do update set value = excluded.value, updated_at = now()`, [String(s)]);
}
