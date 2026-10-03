import { q } from "./db";
import { signGet } from "./r2";

export type Person = { id: number; name: string; aliases: string[]; avatar_url: string | null };
export type Occasion = { id: number; name: string; kind: string };

export async function listPeople(): Promise<Person[]> {
  const rows = await q<{ id: number; name: string; aliases: string[]; thumb_key: string | null }>(
    `select pe.id, pe.name, pe.aliases, ph.thumb_key
       from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where pe.deleted_at is null order by lower(pe.name)`,
  );
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      aliases: r.aliases ?? [],
      avatar_url: r.thumb_key ? await signGet(r.thumb_key) : null,
    })),
  );
}

export function listOccasions() {
  return q<Occasion>(
    `select o.id, o.name, o.kind from occasions o
      order by case o.kind when 'holiday' then 0 when 'occasion' then 1 else 2 end, o.name`,
  );
}

export async function decadesInUse() {
  const rows = await q<{ d: number }>(
    `select distinct coalesce(decade, (year / 10) * 10) as d from photos
      where deleted_at is null and coalesce(decade, year) is not null order by d`,
  );
  return rows.map((r) => r.d);
}

export type Birthday = { id: number; person_id: number; name: string; month: number; day: number; created_by_device: string | null; next: Date; inDays: number };

export async function birthdays(now = new Date()): Promise<Birthday[]> {
  const rows = await q<Omit<Birthday, "next" | "inDays">>(
    `select b.id, b.person_id, pe.name, b.month, b.day, b.created_by_device
       from birthdays b join people pe on pe.id = b.person_id
      where b.deleted_at is null and pe.deleted_at is null`,
  );
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows
    .map((r) => {
      let next = new Date(today.getFullYear(), r.month - 1, r.day);
      if (next < today) next = new Date(today.getFullYear() + 1, r.month - 1, r.day);
      return { ...r, next, inDays: Math.round((next.getTime() - today.getTime()) / 86_400_000) };
    })
    .sort((a, b) => a.inDays - b.inDays);
}

export type Gathering = { id: number; title: string; date: string; time_note: string | null; location: string | null; notes: string | null; created_by_device: string | null; created_by_name: string | null };

export function upcomingGatherings(limit = 50) {
  return q<Gathering>(
    `select id, title, to_char(date, 'YYYY-MM-DD') as date, time_note, location, notes, created_by_device, created_by_name
       from gatherings where deleted_at is null and date >= current_date order by date limit $1`,
    [limit],
  );
}

export async function lastUpload() {
  const [row] = await q<{ name: string | null; n: number; at: string }>(
    `with latest as (select uploaded_by_device, uploaded_by_name, date_trunc('hour', created_at) as h
                       from photos where deleted_at is null order by created_at desc limit 1)
     select l.uploaded_by_name as name, count(*)::int as n, max(p.created_at) as at
       from latest l join photos p on p.uploaded_by_device = l.uploaded_by_device
        and date_trunc('hour', p.created_at) = l.h and p.deleted_at is null
      group by l.uploaded_by_name`,
  );
  return row ?? null;
}

export const shortDate = (d: Date | string) =>
  new Date(typeof d === "string" ? `${d}T12:00:00` : d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function relativeDays(at: string | Date) {
  const days = Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
