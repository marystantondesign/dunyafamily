import { canRemove, isAdmin } from "./auth";
import { displayName } from "./names";
import { q } from "./db";
import { signGet } from "./r2";
import { withThumbs, type Photo, type PhotoRow } from "./photos";
import type { Session } from "./session";

export type Creator = { id: number; name: string; first: string; avatarUrl: string | null };
export type AlbumSummary = {
  id: number; title: string; count: number; createdByName: string | null;
  /** Up to four photos: the chosen cover first, then the most recently added. */
  photos: Photo[];
  /** The profile that started it (null for older albums nobody could be matched to). */
  creator: Creator | null;
  /** Started by the person viewing (their profile, or this device for older albums). */
  mine: boolean;
};
export type AlbumOption = { id: number; title: string; count: number; coverUrl: string | null; covers?: string[] };

const COLS = `p.id, p.original_key, p.thumb_key, p.width, p.height, p.year, p.month, p.decade, p.caption, p.uploaded_by_device, p.uploaded_by_name, p.created_at`;

type Starter = { created_by_person: number | null; created_by_device: string | null };

/** Whether the person viewing started this album: their profile, or for older albums with no profile, this device. */
export const startedBy = (s: Session | null, a: Starter) =>
  !!s && (a.created_by_person ? s.pid === a.created_by_person : !!a.created_by_device && s.did === a.created_by_device);

/** Adding photos: only the person who started the album, or Mary. Occasion and decade albums are never added to by hand. */
export const canAddTo = (s: Session | null, a: Starter) => isAdmin(s) || startedBy(s, a);

/** Every shared album, the most recently added to first. */
export async function listAlbums(s: Session | null = null): Promise<AlbumSummary[]> {
  const rows = await q<{ id: number; title: string; count: number; created_by_name: string | null; created_by_person: number | null; created_by_device: string | null;
    cover_photo_id: number | null; pe_name: string | null; pe_thumb: string | null }>(
    `select a.id, a.title, a.created_by_name, a.created_by_person, a.created_by_device, a.cover_photo_id, pe.name as pe_name, ph.thumb_key as pe_thumb,
            (select count(*)::int from album_photos x join photos p on p.id = x.photo_id and p.deleted_at is null where x.album_id = a.id) as count
       from albums a
       left join people pe on pe.id = a.created_by_person and pe.deleted_at is null
       left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where a.deleted_at is null
      order by greatest(a.created_at, (select max(x.added_at) from album_photos x where x.album_id = a.id)) desc nulls last, a.id desc`,
  );
  return Promise.all(rows.map(async (a) => {
    const name = a.pe_name ? displayName(a.pe_name) : null;
    return {
      id: a.id, title: a.title, count: a.count, createdByName: name ?? (a.created_by_name ? displayName(a.created_by_name) : null),
      creator: name && a.created_by_person ? { id: a.created_by_person, name, first: name.split(/\s+/)[0], avatarUrl: a.pe_thumb ? await signGet(a.pe_thumb) : null } : null,
      mine: startedBy(s, a),
      photos: await withThumbs(await q<PhotoRow>(
        `select ${COLS} from album_photos x join photos p on p.id = x.photo_id and p.deleted_at is null
          where x.album_id = $1 order by (p.id = $2) desc, x.added_at desc, p.id desc limit 4`, [a.id, a.cover_photo_id ?? -1])),
    };
  }));
}

/** For filters (Browse, slideshows): every album, with title, size, and one small photo. */
export async function albumOptions(): Promise<AlbumOption[]> {
  return (await listAlbums()).map((a) => ({ id: a.id, title: a.title, count: a.count, coverUrl: a.photos[0]?.url ?? null }));
}

/** For "Add to album": only the albums the person viewing started. */
export async function myAlbumOptions(s: Session | null): Promise<AlbumOption[]> {
  return (await listAlbums(s)).filter((a) => a.mine).map((a) => ({ id: a.id, title: a.title, count: a.count, coverUrl: a.photos[0]?.url ?? null, covers: a.photos.map((p) => p.url) }));
}

export async function getAlbum(id: number) {
  const [a] = await q<{ id: number; title: string; created_by_device: string | null; created_by_name: string | null; created_by_person: number | null; created_at: string; cover_photo_id: number | null }>(
    `select id, title, created_by_device, created_by_name, created_by_person, created_at, cover_photo_id from albums where id = $1 and deleted_at is null`, [id]);
  return a ? { ...a, created_by_name: a.created_by_name ? displayName(a.created_by_name) : null } : null;
}

export type AutoAlbum = { key: string; title: string; href: string; count: number; photos: Photo[] };

/** Albums made from tags: one per occasion and one per decade, once they have a photo. They fill in as photos are tagged. */
export async function autoAlbums(): Promise<{ occasions: AutoAlbum[]; decades: AutoAlbum[] }> {
  const [occ, dec] = await Promise.all([
    q<PhotoRow & { gid: number; gname: string; n: number }>(
      `select * from (
         select ${COLS}, o.id as gid, o.name as gname, count(*) over (partition by o.id)::int as n,
                row_number() over (partition by o.id order by p.created_at desc, p.id desc) as rn
           from occasions o join photo_occasions x on x.occasion_id = o.id join photos p on p.id = x.photo_id and p.deleted_at is null
          where o.deleted_at is null
       ) t where rn <= 4 order by n desc, gname, rn`),
    q<PhotoRow & { gid: number; n: number }>(
      `select * from (
         select ${COLS}, coalesce(p.decade, (p.year / 10) * 10) as gid, count(*) over (partition by coalesce(p.decade, (p.year / 10) * 10))::int as n,
                row_number() over (partition by coalesce(p.decade, (p.year / 10) * 10) order by p.created_at desc, p.id desc) as rn
           from photos p where p.deleted_at is null and coalesce(p.decade, p.year) is not null and coalesce(p.decade, (p.year / 10) * 10) >= 1940
       ) t where rn <= 4 order by gid, rn`),
  ]);
  const group = async (rows: (PhotoRow & { gid: number; n: number; gname?: string })[], make: (r: { gid: number; gname?: string }) => { key: string; title: string; href: string }) => {
    const out: AutoAlbum[] = [];
    for (const r of rows) {
      let g = out.find((x) => x.key === make(r).key);
      if (!g) { g = { ...make(r), count: r.n, photos: [] }; out.push(g); }
      g.photos.push(...await withThumbs([r]));
    }
    return out;
  };
  return {
    occasions: await group(occ, (r) => ({ key: `o${r.gid}`, title: r.gname!, href: `/browse?occasions=${r.gid}` })),
    decades: await group(dec, (r) => ({ key: `d${r.gid}`, title: `${r.gid}s`, href: `/browse?decade=${r.gid}` })),
  };
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

export const NOT_YOURS = "You can only add photos to albums you started.";

/**
 * An existing album by id (one you can add to), or a new one by title. A title matching one of your own albums reuses
 * it instead of making a twin; a title matching someone else's starts your own.
 */
export async function resolveAlbum(pick: { albumId?: number; newTitle?: string } | null | undefined, s: Session): Promise<{ id: number; title: string } | { error: string } | null> {
  if (!pick) return null;
  if (pick.albumId) {
    const a = await getAlbum(Number(pick.albumId));
    if (!a) return { error: "That album isn't here anymore. Choose another." };
    return canAddTo(s, a) ? { id: a.id, title: a.title } : { error: NOT_YOURS };
  }
  const title = cleanTitle(pick.newTitle);
  if (!title) return { error: "Give the album a name." };
  const same = await q<{ id: number; title: string; created_by_person: number | null; created_by_device: string | null }>(
    `select id, title, created_by_person, created_by_device from albums where deleted_at is null and lower(title) = lower($1)`, [title]);
  const own = same.find((a) => startedBy(s, a));
  if (own) return { id: own.id, title: own.title };
  const [row] = await q<{ id: number }>(`insert into albums (title, created_by_device, created_by_name, created_by_person) values ($1, $2, $3, $4) returning id`,
    [title, s.did, s.name, s.pid ?? null]);
  return { id: row.id, title };
}

/** Callers check canAddTo first. Photos already in the album are left as they are. Returns how many were new. */
export async function addToAlbum(albumId: number, photoIds: number[], s: Session) {
  const rows = await q<{ photo_id: number }>(
    `insert into album_photos (album_id, photo_id, added_by_device)
     select $1, p.id, $3 from photos p where p.id = any($2::int[]) and p.deleted_at is null
     on conflict do nothing returning photo_id`, [albumId, photoIds, s.did]);
  return rows.length;
}

/** Taking a photo out of an album: whoever put it there, whoever started the album, or Mary. The photo itself stays. */
export const canTakeOut = (s: Session | null, addedBy: string | null, albumBy: string | null) => canRemove(s, addedBy) || canRemove(s, albumBy);
