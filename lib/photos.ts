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
  months?: number[];
  season?: { months: number[]; occasionId?: number };
  untagged?: boolean;
};

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
  if (f.months?.length) where.push(`p.month = any(${$(f.months)}::int[])`);
  if (f.season)
    where.push(
      `(p.month = any(${$(f.season.months)}::int[]) or exists (select 1 from photo_occasions x where x.photo_id = p.id and x.occasion_id = ${$(f.season.occasionId ?? -1)}))`,
    );
  if (f.untagged)
    where.push(
      `p.year is null and p.decade is null and not exists (select 1 from photo_people x where x.photo_id = p.id) and not exists (select 1 from photo_occasions x where x.photo_id = p.id)`,
    );
  return { where: where.join(" and "), params, $ };
}

const ORDER = {
  oldest: "coalesce(p.year, p.decade) asc nulls last, p.month asc nulls last, p.id asc",
  newest: "coalesce(p.year, p.decade) desc nulls last, p.month desc nulls last, p.id desc",
  recent: "p.created_at desc",
  random: "random()",
};

export async function findPhotos(f: Filters, opts: { order?: keyof typeof ORDER; limit?: number; offset?: number } = {}) {
  const { where, params, $ } = build(f);
  const rows = await q<PhotoRow>(
    `select p.id, p.original_key, p.thumb_key, p.width, p.height, p.year, p.month, p.decade, p.caption,
            p.uploaded_by_device, p.uploaded_by_name, p.created_at
       from photos p where ${where}
      order by ${ORDER[opts.order ?? "newest"]}
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

export function whenLabel(p: Pick<PhotoRow, "year" | "decade" | "month">) {
  if (p.year && p.month)
    return `${new Date(2000, p.month - 1, 1).toLocaleString("en-US", { month: "long" })} ${p.year}`;
  if (p.year) return String(p.year);
  if (p.decade) return `${p.decade}s`;
  return null;
}
