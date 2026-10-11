import { q } from "./db";
import { countPhotos, findPhotos, withThumbs, type Filters, type Photo, type PhotoRow } from "./photos";
import { seasonMonths } from "./hero";

/** Dunya is the root of the family. She may be saved as "Dunya" or "Mamaw", or have one as an alias. */
export async function findDunya() {
  const [row] = await q<{ id: number; name: string; avatar_photo_id: number | null }>(
    `select pe.id, pe.name, pe.avatar_photo_id from people pe
      where pe.deleted_at is null
        and (lower(pe.name) in ('dunya', 'mamaw') or exists (select 1 from unnest(pe.aliases) a where lower(a) in ('dunya', 'mamaw')))
      order by (select count(*) from photo_people x where x.person_id = pe.id) desc limit 1`,
  );
  return row ?? null;
}

const COLS = `p.id, p.original_key, p.thumb_key, p.width, p.height, p.year, p.month, p.decade, p.caption, p.uploaded_by_device, p.uploaded_by_name, p.created_at`;

/** The polaroid on Home: Dunya's profile photo, or else the photo of her with the fewest other people in it. */
export async function heroPortrait(): Promise<{ photo: Photo | null; personId: number | null }> {
  const dunya = await findDunya();
  if (!dunya) return { photo: null, personId: null };
  const rows = await q<PhotoRow>(
    `select ${COLS} from photos p
      where p.deleted_at is null and (p.id = $2 or exists (select 1 from photo_people x where x.photo_id = p.id and x.person_id = $1))
      order by (p.id = $2) desc, (select count(*) from photo_people y where y.photo_id = p.id) asc, p.id desc limit 1`,
    [dunya.id, dunya.avatar_photo_id ?? -1],
  );
  const [photo] = await withThumbs(rows);
  return { photo: photo ?? null, personId: dunya.id };
}

export type Album = { title: string; text: string; href: string; photos: Photo[] };

/** Three photos spread across someone's life: the earliest, one from the middle, and the latest. */
async function throughTheYears(personId: number) {
  const all = await findPhotos({ people: [personId] }, { order: "oldest", limit: 2000 });
  const dated = all.filter((p) => p.year || p.decade);
  const pool = dated.length >= 3 ? dated : all;
  if (pool.length <= 3) return pool;
  return [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]];
}

/**
 * Featured albums are built from tags until shared albums exist: Mamaw through the years, Christmas, and Summer,
 * then other occasions with the most photos if any of those are empty.
 */
export async function featuredAlbums(limit = 3): Promise<Album[]> {
  const albums: Album[] = [];
  const dunya = await findDunya();
  if (dunya) {
    const photos = await throughTheYears(dunya.id);
    if (photos.length) albums.push({ title: "Mamaw through the years", text: "A lifetime of love.", href: `/people/${dunya.id}`, photos });
  }

  const occasions = await q<{ id: number; name: string; kind: string; n: number }>(
    `select o.id, o.name, o.kind, count(p.id)::int as n from occasions o
       join photo_occasions x on x.occasion_id = o.id join photos p on p.id = x.photo_id and p.deleted_at is null
      group by o.id order by n desc`,
  );
  const idOf = (name: string) => occasions.find((o) => o.name.toLowerCase() === name.toLowerCase())?.id;
  const tryAlbum = async (title: string, text: string, href: string, f: Filters) => {
    if (albums.length >= limit || !(await countPhotos(f))) return;
    albums.push({ title, text, href, photos: await findPhotos(f, { order: "random", limit: 3 }) });
  };

  const christmas = idOf("Christmas");
  if (christmas) await tryAlbum("Christmas together", "Decorations, traditions, and family.", `/browse?occasions=${christmas}`, { occasions: [christmas] });
  await tryAlbum("Summer memories", "Lakes, beaches, and long afternoons.", "/browse?season=Summer",
    { season: { months: seasonMonths("Summer"), occasionId: idOf("Summer") } });

  const extras: Record<string, string> = {
    Thanksgiving: "Gathered around the table.", Birthday: "Candles, cake, and another year.", Halloween: "Costumes and candy.",
    Easter: "Baskets and Sunday best.", Wedding: "Vows, dancing, and family.", Vacation: "Trips and time away.",
  };
  for (const o of occasions) {
    if (albums.length >= limit) break;
    if (o.id === christmas || o.name === "Summer") continue;
    await tryAlbum(`${o.name} through the years`, extras[o.name] ?? `${o.n} ${o.n === 1 ? "photo" : "photos"}.`, `/browse?occasions=${o.id}`, { occasions: [o.id] });
  }
  if (albums.length < limit) await tryAlbum("Recently added", "The newest photos in the collection.", "/browse", {});
  return albums;
}
