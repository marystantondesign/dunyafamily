import { q } from "./db";
import { signGet } from "./r2";

export type PhotoRow = {
  id: number;
  original_key: string;
  thumb_key: string;
  width: number | null;
  height: number | null;
  year: number | null;
  month: number | null;
  decade: number | null;
  caption: string | null;
  uploaded_by_device: string;
  uploaded_by_name: string | null;
  created_at: string;
};
export type Photo = PhotoRow & { url: string };

export type Filters = {
  people?: number[];
  occasions?: number[];
  year?: number;
  decade?: number;
  /** Any of these decades (browse lets you check several). */
  decades?: number[];
  months?: number[];
  season?: { months: number[]; occasionId?: number };
  untagged?: boolean;
  /** One upload, by its upload_batch id. */
  batch?: string;
  /** Photos in any of these shared albums. */
  albums?: number[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function build(f: Filters) {
  const where = ["p.deleted_at is null"];
  const params: unknown[] = [];
  const $ = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  // Every selected pill must match (AND), so "Grandma + Mary" means photos with both.
  for (const id of f.people ?? [])
    where.push(`exists (select 1 from photo_people x where x.photo_id = p.id and x.person_id = ${$(id)})`);
  for (const id of f.occasions ?? [])
    where.push(`exists (select 1 from photo_occasions x where x.photo_id = p.id and x.occasion_id = ${$(id)})`);
  if (f.year) where.push(`p.year = ${$(f.year)}`);
  if (f.decade) where.push(`coalesce(p.decade, (p.year / 10) * 10) = ${$(f.decade)}`);
  if (f.decades?.length) where.push(`coalesce(p.decade, (p.year / 10) * 10) = any(${$(f.decades)}::int[])`);
  if (f.months?.length) where.push(`p.month = any(${$(f.months)}::int[])`);
  if (f.season)
    where.push(
      `(p.month = any(${$(f.season.months)}::int[]) or exists (select 1 from photo_occasions x where x.photo_id = p.id and x.occasion_id = ${$(f.season.occasionId ?? -1)}))`,
    );
  if (f.untagged)
    where.push(
      `p.year is null and p.decade is null and not exists (select 1 from photo_people x where x.photo_id = p.id) and not exists (select 1 from photo_occasions x where x.photo_id = p.id)`,
    );
  if (f.albums?.length)
    where.push(`exists (select 1 from album_photos x where x.photo_id = p.id and x.album_id = any(${$(f.albums)}::int[]))`);
  if (f.batch) where.push(UUID.test(f.batch) ? `p.upload_batch = ${$(f.batch)}::uuid` : "false");
  return { where: where.join(" and "), params, $ };
}

const ORDER = {
  oldest: "coalesce(p.year, p.decade) asc nulls last, p.month asc nulls last, p.id asc",
  newest: "coalesce(p.year, p.decade) desc nulls last, p.month desc nulls last, p.id desc",
  recent: "p.created_at desc",
  uploaded: "p.id asc",
  random: "random()",
  // Random, but the same for the whole visit: the seed comes from the df_shuffle cookie (see lib/shuffle).
  shuffled: "SHUFFLED",
};
export type Order = keyof typeof ORDER;

function orderBy(order: Order, $: (v: unknown) => string, seed?: string) {
  return order === "shuffled" ? `md5(p.id::text || ${$(seed ?? "0")}), p.id` : ORDER[order];
}

export async function findPhotos(f: Filters, opts: { order?: Order; seed?: string; limit?: number; offset?: number } = {}) {
  const { where, params, $ } = build(f);
  const rows = await q<PhotoRow>(
    `select p.id, p.original_key, p.thumb_key, p.width, p.height, p.year, p.month, p.decade, p.caption,
            p.uploaded_by_device, p.uploaded_by_name, p.created_at
       from photos p where ${where}
      order by ${orderBy(opts.order ?? "newest", $, opts.seed)}
      limit ${$(opts.limit ?? 120)} offset ${$(opts.offset ?? 0)}`,
    params,
  );
  return withThumbs(rows);
}

export async function countPhotos(f: Filters) {
  const { where, params } = build(f);
  const [row] = await q<{ n: number }>(`select count(*)::int as n from photos p where ${where}`, params);
  return row?.n ?? 0;
}

export function withThumbs(rows: PhotoRow[]): Promise<Photo[]> {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signGet(r.thumb_key) })));
}

export { whenLabel } from "./when";

export type TagTarget = {
  id: number; width: number | null; height: number | null; year: number | null; decade: number | null;
  uploaded_by_device: string;
  people: { id: number; by: string | null }[];
  occasions: { id: number; by: string | null }[];
  thumb: string; url: string;
};

/** Everything tagging mode needs for each photo, with links that last long enough for a long session. */
export async function findForTagging(f: Filters, order: Order, limit = 1000, seed?: string): Promise<TagTarget[]> {
  const { where, params, $ } = build(f);
  const rows = await q<Omit<TagTarget, "thumb" | "url"> & { original_key: string; thumb_key: string }>(
    `select p.id, p.width, p.height, p.year, p.decade, p.uploaded_by_device, p.original_key, p.thumb_key,
            coalesce((select json_agg(json_build_object('id', x.person_id, 'by', x.added_by_device))
                        from photo_people x join people pe on pe.id = x.person_id and pe.deleted_at is null
                       where x.photo_id = p.id), '[]') as people,
            coalesce((select json_agg(json_build_object('id', x.occasion_id, 'by', x.added_by_device))
                        from photo_occasions x where x.photo_id = p.id), '[]') as occasions
       from photos p where ${where}
      order by ${orderBy(order, $, seed)} limit ${$(limit)}`,
    params,
  );
  const hours6 = 6 * 60 * 60;
  return Promise.all(
    rows.map(async ({ original_key, thumb_key, ...r }) => ({
      ...r,
      thumb: await signGet(thumb_key, hours6),
      url: await signGet(original_key, hours6),
    })),
  );
}

/** The photos on either side of this one, in the same filtered and ordered list the person came from. */
export async function neighbors(f: Filters, order: Order, id: number, seed?: string) {
  const { where, params, $ } = build(f);
  const [row] = await q<{ prev: number | null; next: number | null; pos: number; total: number }>(
    `select prev, next, pos::int, total::int from (
       select p.id, lag(p.id) over w as prev, lead(p.id) over w as next,
              row_number() over w as pos, count(*) over () as total
         from photos p where ${where} window w as (order by ${orderBy(order, $, seed)})
     ) t where id = ${$(id)}`,
    params,
  );
  return row ?? null;
}

export type Slide = { id: number; title: string | null; occasion: string | null; year: number | null; decade: number | null; month: number | null; people: string[] };

/** Everything a slideshow needs to play a view, in the same order browse shows it. No file links: those are fetched as it plays. */
export async function findSlides(f: Filters, order: Order, seed?: string, limit = 5000): Promise<Slide[]> {
  const { where, params, $ } = build(f);
  return q<Slide>(
    `select p.id, p.title, p.year, p.decade, p.month,
            (select o.name from photo_occasions x join occasions o on o.id = x.occasion_id where x.photo_id = p.id order by o.name limit 1) as occasion,
            coalesce((select array_agg(pe.name order by pe.name) from photo_people x join people pe on pe.id = x.person_id and pe.deleted_at is null
                       where x.photo_id = p.id), '{}') as people
       from photos p where ${where}
      order by ${orderBy(order, $, seed)} limit ${$(limit)}`,
    params,
  );
}
