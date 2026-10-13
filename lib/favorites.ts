import { q } from "./db";

/** Favorites belong to the person picked under "who are you". Only they see them. */

export async function isFavorite(pid: number | undefined, photoId: number) {
  if (!pid) return false;
  const [r] = await q(`select 1 from favorites where person_id = $1 and photo_id = $2`, [pid, photoId]).catch(() => []);
  return !!r;
}

export async function favoriteCount(pid: number | undefined) {
  if (!pid) return 0;
  const [r] = await q<{ n: number }>(
    `select count(*)::int as n from favorites f join photos p on p.id = f.photo_id and p.deleted_at is null where f.person_id = $1`, [pid]).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

/** This person's favorites, newest favorited first. */
export async function favoriteIds(pid: number) {
  const rows = await q<{ photo_id: number }>(
    `select f.photo_id from favorites f join photos p on p.id = f.photo_id and p.deleted_at is null
      where f.person_id = $1 order by f.created_at desc`, [pid]);
  return rows.map((r) => r.photo_id);
}

/** Star or unstar a photo. Returns the reason when it can't. */
export async function setFavorite(pid: number, photoId: number, on: boolean): Promise<string | null> {
  const [me] = await q(`select 1 from people where id = $1 and deleted_at is null`, [pid]);
  if (!me) return "Choose who you are first, from your picture at the top.";
  if (!on) {
    await q(`delete from favorites where person_id = $1 and photo_id = $2`, [pid, photoId]);
    return null;
  }
  const [photo] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [photoId]);
  if (!photo) return "That photo isn't here anymore.";
  await q(`insert into favorites (person_id, photo_id) values ($1, $2) on conflict do nothing`, [pid, photoId]);
  return null;
}
