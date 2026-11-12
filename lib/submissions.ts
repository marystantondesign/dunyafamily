import { q } from "./db";
import { findDunya } from "./featured";
import { displayName } from "./names";
import { signGet } from "./r2";

/** Submit a story: what family members send Mary privately. Only Mary ever reads these. */
export const SUB_KEY = /^submissions\/[0-9a-f-]{36}(-thumb)?\.jpg$/;

type Row = {
  id: number; person_id: number | null; from_name: string | null; from_thumb: string | null; about: number[]; title: string; body: string;
  photo_keys: string[]; thumb_keys: string[]; photo_ids: number[]; created_at: string; read_at: string | null; draft_story_id: number | null;
};
const SELECT = `select s.id, s.person_id, coalesce(pe.name, s.submitted_by_name) as from_name, ph.thumb_key as from_thumb, s.about, s.title, s.body,
    s.photo_keys, s.thumb_keys, coalesce(s.photo_ids, '{}') as photo_ids, s.created_at, s.read_at, s.draft_story_id
  from story_submissions s
  left join people pe on pe.id = s.person_id
  left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
  where s.deleted_at is null`;

export const fmtReceived = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

export async function submissionCount() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from story_submissions where deleted_at is null`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

/** For the dot on "My stories": submissions Mary hasn't opened yet. */
export async function unreadSubmissions() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from story_submissions where deleted_at is null and read_at is null`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

async function names(ids: number[]) {
  return new Map((ids.length ? await q<{ id: number; name: string }>(`select id, name from people where id = any($1::int[])`, [ids]) : [])
    .map((p) => [p.id, displayName(p.name)]));
}

/** Archive photos still on the site, by id, with their thumbnails. */
async function archive(ids: number[]) {
  if (!ids.length) return new Map<number, { thumb: string; full: string }>();
  const rows = await q<{ id: number; thumb_key: string; original_key: string }>(
    `select id, thumb_key, original_key from photos where id = any($1::int[]) and deleted_at is null`, [ids]);
  return new Map(await Promise.all(rows.map(async (r) => [r.id, { thumb: await signGet(r.thumb_key), full: await signGet(r.original_key) }] as const)));
}

export type SubmissionRow = {
  id: number; title: string; firstLine: string; from: string; fromAvatar: string | null; about: string[]; received: string; thumbUrl: string | null; unread: boolean;
};

/** The Submitted tab: newest first, with the first photo (archive photos first, then the sender's own). */
export async function submissionRows(): Promise<SubmissionRow[]> {
  const rows = await q<Row>(`${SELECT} order by s.created_at desc`).catch(() => [] as Row[]);
  const people = await names([...new Set(rows.flatMap((r) => r.about ?? []))]);
  const photos = await archive([...new Set(rows.map((r) => r.photo_ids?.[0]).filter((x): x is number => !!x))]);
  return Promise.all(rows.map(async (r) => ({
    id: r.id, title: r.title.trim(), firstLine: r.body.trim().split(/\n/)[0].slice(0, 140),
    from: r.from_name ? displayName(r.from_name) : "Someone", fromAvatar: r.from_thumb ? await signGet(r.from_thumb) : null,
    about: (r.about ?? []).map((a) => people.get(a)).filter((n): n is string => !!n), received: fmtReceived(r.created_at),
    thumbUrl: r.photo_ids?.[0] && photos.get(r.photo_ids[0]) ? photos.get(r.photo_ids[0])!.thumb : r.thumb_keys?.[0] ? await signGet(r.thumb_keys[0]) : null,
    unread: !r.read_at,
  })));
}

export type Submission = {
  id: number; title: string; body: string; from: string; fromId: number | null; fromAvatar: string | null; about: { id: number; name: string }[];
  received: string; photos: { thumb: string; full: string }[]; draftStoryId: number | null;
};

/** One submission, read-only, for Mary. Opening it marks it read. */
export async function submission(id: number): Promise<Submission | null> {
  const [r] = await q<Row>(`${SELECT} and s.id = $1`, [id]);
  if (!r) return null;
  if (!r.read_at) await q(`update story_submissions set read_at = now() where id = $1`, [id]);
  const people = await names(r.about ?? []);
  const linked = await archive(r.photo_ids ?? []);
  const own = await Promise.all((r.photo_keys ?? []).map(async (k, i) => ({ full: await signGet(k), thumb: await signGet(r.thumb_keys?.[i] ?? k) })));
  return {
    id: r.id, title: r.title.trim(), body: r.body, from: r.from_name ? displayName(r.from_name) : "Someone", fromId: r.person_id,
    fromAvatar: r.from_thumb ? await signGet(r.from_thumb) : null,
    about: (r.about ?? []).flatMap((a) => (people.get(a) ? [{ id: a, name: people.get(a)! }] : [])), received: fmtReceived(r.created_at),
    photos: [...(r.photo_ids ?? []).flatMap((pid) => (linked.get(pid) ? [linked.get(pid)!] : [])), ...own], draftStoryId: r.draft_story_id,
  };
}

/**
 * Make it a draft: a new admin draft with the title, the story as paragraphs, the photos (archive photos by id, the
 * sender's own as private images), the people (Dunya stays out, as on every story), and the sender as its credit.
 */
export async function draftFrom(id: number) {
  const [r] = await q<Row>(`${SELECT} and s.id = $1`, [id]);
  if (!r) return null;
  if (r.draft_story_id) {
    const [still] = await q(`select 1 from stories where id = $1 and deleted_at is null`, [r.draft_story_id]);
    if (still) return r.draft_story_id;
  }
  const paras = r.body.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const blocks = [...paras, ...(r.photo_ids ?? []).map((p) => `[photo ${p}]`), ...(r.photo_keys ?? []).map((k) => `[image ${k}]`)];
  const dunya = await findDunya();
  const people = (r.about ?? []).filter((p) => p !== dunya?.id);
  const [s] = await q<{ id: number }>(
    `insert into stories (title, status, question, body, people, credit_person_id, credit_name) values ($1, 'draft', '', $2, $3, $4, $5) returning id`,
    [r.title.trim(), blocks.join("\n\n"), people, r.person_id, r.from_name ? displayName(r.from_name) : null]);
  await q(`update story_submissions set draft_story_id = $2, read_at = coalesce(read_at, now()) where id = $1`, [id, s.id]);
  return s.id;
}
