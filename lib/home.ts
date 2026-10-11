import { listAlbums } from "./albums";
import { q } from "./db";
import { heroPortrait } from "./featured";
import { seasonMonths } from "./hero";
import { displayName } from "./names";
import { countPhotos, findPhotos, type Filters, type PhotoRow } from "./photos";
import { signGet } from "./r2";

/** The homepage headline. Placeholder copy until Mary sends the final words. */
export const HOME_COPY = {
  title: "Who we are",
  subtitle: "Our photos, our dates, and the family tree going back.",
};

export type Slide = { id: number; url: string; caption: string | null };

const COLS = `p.id, p.original_key, p.thumb_key, p.width, p.height, p.year, p.month, p.decade, p.caption, p.uploaded_by_device, p.uploaded_by_name, p.created_at`;

/**
 * The Polaroid on Home: up to 10 photos the admin chose, each with a handwritten caption, in order.
 * Until any are chosen, a profile photo of Dunya with no caption.
 */
export async function heroSlides(): Promise<{ slides: Slide[]; seconds: number }> {
  const [chosen, interval] = await Promise.all([
    // The homepage_photos table arrives with the Homepage photos admin page. Until then this finds nothing.
    q<PhotoRow & { hp_caption: string | null }>(
      `select ${COLS}, h.caption as hp_caption from homepage_photos h join photos p on p.id = h.photo_id and p.deleted_at is null
        order by h.position, h.created_at limit 10`).catch(() => []),
    q<{ value: string | null }>(`select value from settings where key = 'homepage_interval'`).catch(() => []),
  ]);
  const seconds = Math.min(30, Math.max(3, Number(interval[0]?.value) || 6));
  if (chosen.length) {
    // The 800px thumbnails are plenty for a Polaroid this size.
    const urls = await Promise.all(chosen.map((p) => signGet(p.thumb_key)));
    return { slides: chosen.map((p, i) => ({ id: p.id, url: urls[i], caption: p.hp_caption?.trim() || null })), seconds };
  }
  const { photo } = await heroPortrait();
  return { slides: photo ? [{ id: photo.id, url: photo.url, caption: null }] : [], seconds };
}

export type Collection = { key: string; title: string; href: string; count: number; photos: { id: number; url: string }[] };

const SEASONS: { name: string; title: string }[] = [
  { name: "Summer", title: "Summers" }, { name: "Christmas", title: "Christmases" }, { name: "Thanksgiving", title: "Thanksgivings" },
  { name: "Winter", title: "Winters" }, { name: "Autumn", title: "Autumns" },
];

/** Featured albums: real shared albums mixed with automatic collections (a decade, a season), four in all. */
export async function featuredCollections(limit = 4): Promise<Collection[]> {
  const albums = (await listAlbums()).filter((a) => a.count > 0).map((a) => ({
    key: `a${a.id}`, title: a.title, href: `/albums/${a.id}`, count: a.count, photos: a.photos.map(({ id, url }) => ({ id, url })),
  }));

  const auto: Collection[] = [];
  const pick = async (key: string, title: string, href: string, f: Filters) => {
    const count = await countPhotos(f);
    if (!count) return;
    const photos = await findPhotos(f, { order: "random", limit: 3 });
    auto.push({ key, title, href, count, photos: photos.map(({ id, url }) => ({ id, url })) });
  };
  const decades = await q<{ d: number; n: number }>(
    `select coalesce(decade, (year / 10) * 10) as d, count(*)::int as n from photos
      where deleted_at is null and coalesce(decade, year) is not null group by 1 order by n desc limit 2`);
  const occasions = await q<{ id: number; name: string }>(`select id, name from occasions`);
  if (decades[0]) await pick(`d${decades[0].d}`, `The ${decades[0].d}s`, `/browse?decade=${decades[0].d}`, { decades: [decades[0].d] });
  for (const s of SEASONS) {
    if (auto.length >= 2) break;
    const occ = occasions.find((o) => o.name.toLowerCase() === s.name.toLowerCase());
    const months = seasonMonths(s.name);
    const f: Filters = months ? { season: { months, occasionId: occ?.id } } : occ ? { occasions: [occ.id] } : {};
    if (!months && !occ) continue;
    await pick(`s${s.name}`, s.title, months ? `/browse?season=${s.name}` : `/browse?occasions=${occ!.id}`, f);
  }
  if (decades[1] && albums.length + auto.length < limit)
    await pick(`d${decades[1].d}`, `The ${decades[1].d}s`, `/browse?decade=${decades[1].d}`, { decades: [decades[1].d] });

  // Album, collection, collection, album, then whatever is left.
  const out: Collection[] = [];
  const pattern = ["album", "auto", "auto", "album"];
  for (const kind of pattern) {
    const next = kind === "album" ? albums.shift() ?? auto.shift() : auto.shift() ?? albums.shift();
    if (next) out.push(next);
  }
  return [...out, ...albums, ...auto].slice(0, limit);
}

export type Member = { id: number; name: string; avatarUrl: string | null; inMemory: boolean; photos: number };

/** Everyone in the family with how many photos they're in, A to Z. */
export async function everyone(): Promise<Member[]> {
  const rows = await q<{ id: number; name: string; thumb_key: string | null; in_memory: boolean; n: number }>(
    `select pe.id, pe.name, ph.thumb_key, pe.in_memory,
            (select count(*)::int from photo_people x join photos p on p.id = x.photo_id and p.deleted_at is null where x.person_id = pe.id) as n
       from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where pe.deleted_at is null order by lower(pe.name)`);
  return Promise.all(rows.map(async (r) => ({
    id: r.id, name: displayName(r.name), inMemory: !!r.in_memory, photos: r.n, avatarUrl: r.thumb_key ? await signGet(r.thumb_key) : null,
  })));
}

