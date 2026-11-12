import { q } from "./db";
import { displayName } from "./names";
import { signGet } from "./r2";

/** Submit a story: what family members send Mary privately. Only Mary ever reads these. */
export const SUB_KEY = /^submissions\/[0-9a-f-]{36}(-thumb)?\.jpg$/;

export async function submissionCount() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from story_submissions where deleted_at is null`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

export async function submissions() {
  const rows = await q<{ id: number; from_name: string | null; about: number[]; title: string; body: string; photo_keys: string[]; thumb_keys: string[]; created_at: string }>(
    `select s.id, coalesce(pe.name, s.submitted_by_name) as from_name, s.about, s.title, s.body, s.photo_keys, s.thumb_keys, s.created_at
       from story_submissions s left join people pe on pe.id = s.person_id
      where s.deleted_at is null order by s.created_at desc`).catch(() => []);
  const ids = [...new Set(rows.flatMap((r) => r.about ?? []))];
  const names = new Map((ids.length ? await q<{ id: number; name: string }>(`select id, name from people where id = any($1::int[])`, [ids]) : [])
    .map((p) => [p.id, displayName(p.name)]));
  return Promise.all(rows.map(async (r) => ({
    id: r.id, from: r.from_name ? displayName(r.from_name) : "Someone", at: new Date(r.created_at).toISOString(),
    about: (r.about ?? []).map((a) => names.get(a)).filter((n): n is string => !!n), title: r.title, body: r.body,
    photos: await Promise.all((r.photo_keys ?? []).map(async (k, i) => ({ full: await signGet(k), thumb: await signGet(r.thumb_keys?.[i] ?? k) }))),
  })));
}
