import { canRemove } from "./auth";
import { displayName } from "./names";
import { q } from "./db";
import { withThumbs, type Photo, type PhotoRow } from "./photos";
import type { Session } from "./session";

export type AlbumSummary = {
  id: number; title: string; count: number; createdByName: string | null;
  /** Up to three photos: the chosen cover first, then the most recently added. */
  photos: Photo[];
};
export type AlbumOption = { id: number; title: string; count: number; coverUrl: string | null };

const COLS = `p.id, p.original_key, p.thumb_key, p.width, p.height, p.year, p.month, p.decade, p.caption, p.uploaded_by_device, p.uploaded_by_name, p.created_at`;

/** Every shared album, the most recently added to first. */
export async function listAlbums(): Promise<AlbumSummary[]> {
  const rows = await q<{ id: number; title: string; count: number; created_by_name: string | null; cover_photo_id: number | null }>(
    `select a.id, a.title, a.created_by_name, a.cover_photo_id,
            (select count(*)::int from album_photos x join photos p on p.id = x.photo_id and p.deleted_at is null where x.album_id = a.id) as count
       from albums a where a.deleted_at is null
      order by greatest(a.created_at, (select max(x.added_at) from album_photos x where x.album_id = a.id)) desc nulls last, a.id desc`,
  );
  return Promise.all(rows.map(async (a) => ({
    id: a.id, title: a.title, count: a.count, createdByName: a.created_by_name ? displayName(a.created_by_name) : null,
    photos: await withThumbs(await q<PhotoRow>(
      `select ${COLS} from album_photos x join photos p on p.id = x.photo_id and p.deleted_at is null
        where x.album_id = $1 order by (p.id = $2) desc, x.added_at desc, p.id desc limit 3`, [a.id, a.cover_photo_id ?? -1])),
  })));
}

/** For pickers: title, size, and one small photo. */
export async function albumOptions(): Promise<AlbumOption[]> {
  return (await listAlbums()).map((a) => ({ id: a.id, title: a.title, count: a.count, coverUrl: a.photos[0]?.url ?? null }));
}

export async function getAlbum(id: number) {
  const [a] = await q<{ id: number; title: string; created_by_device: string | null; created_by_name: string | null; created_at: string; cover_photo_id: number | null }>(
    `select id, title, created_by_device, created_by_name, created_at, cover_photo_id from albums where id = $1 and deleted_at is null`, [id]);
  return a ? { ...a, created_by_name: a.created_by_name ? displayName(a.created_by_name) : null } : null;
}

/** The albums a photo is in. */
export function albumsFor(photoId: number) {
  return q<{ id: number; title: string; added_by_device: string | null; created_by_device: string | null }>(
    `select a.id, a.title, x.added_by_device, a.created_by_device from album_photos x join albums a on a.id = x.album_id and a.deleted_at is null
      where x.photo_id = $1 order by a.title`, [photoId]);
}

/** Tidy spacing and start with a capital, so "memrie's wedding" shows as "Memrie's wedding". */
export const cleanTitle = (t: unknown) => {
  const s = String(t ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** An existing album by id, or a new one by title (reusing an album with the same name instead of making a twin). */
export async function resolveAlbum(pick: { albumId?: number; newTitle?: string } | null | undefined, s: Session): Promise<{ id: number; title: string } | { error: string } | null> {
  if (!pick) return null;
  if (pick.albumId) {
    const a = await getAlbum(Number(pick.albumId));
    return a ? { id: a.id, title: a.title } : { error: "That album isn't here anymore. Choose another." };
  }
  const title = cleanTitle(pick.newTitle);
  if (!title) return { error: "Give the album a name." };
  const [existing] = await q<{ id: number; title: string }>(`select id, title from albums where deleted_at is null and lower(title) = lower($1) limit 1`, [title]);
  if (existing) return existing;
  const [row] = await q<{ id: number }>(`insert into albums (title, created_by_device, created_by_name) values ($1, $2, $3) returning id`, [title, s.did, s.name]);
  return { id: row.id, title };
}

/** Anyone can add. Photos already in the album are left as they are. Returns how many were new. */
export async function addToAlbum(albumId: number, photoIds: number[], s: Session) {
  const rows = await q<{ photo_id: number }>(
    `insert into album_photos (album_id, photo_id, added_by_device)
     select $1, p.id, $3 from photos p where p.id = any($2::int[]) and p.deleted_at is null
     on conflict do nothing returning photo_id`, [albumId, photoIds, s.did]);
  return rows.length;
}

/** Taking a photo out of an album: whoever put it there, whoever started the album, or Mary. The photo itself stays. */
export const canTakeOut = (s: Session | null, addedBy: string | null, albumBy: string | null) => canRemove(s, addedBy) || canRemove(s, albumBy);
