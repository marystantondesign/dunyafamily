import { q } from "./db";
import { findDunya } from "./featured";
import { displayName } from "./names";
import { signGet } from "./r2";
import { parseBody, themeLabel } from "./stories";

/**
 * My stories (Mary only): every story that isn't removed, split into Drafts, Published and Private, plus what the
 * Add a story form needs. Nothing here is ever shown to anyone else.
 */

export type StoryTab = "draft" | "published" | "private";

export type MyStoryRow = {
  id: number; tab: StoryTab; title: string; question: string; thumbUrl: string | null; meta: string; needs: string[];
};

const fmtDay = (d: string | Date | null) =>
  d ? new Date(typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "";

/** Today in America/New_York as YYYY-MM-DD. */
export function todayNY() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Each tab's rows, already sorted: drafts and private by last edit, published by publish date (newest first). */
export async function myStories(): Promise<Record<StoryTab, MyStoryRow[]>> {
  const rows = await q<{
    id: number; title: string; question: string; status: string; theme: string | null; people: number[]; notion_id: string | null;
    dont_share: boolean | null; recorded_on: string | null; created_at: string; updated_at: string; published_at: string | null; thumb_key: string | null;
  }>(
    `select s.id, s.title, s.question, s.status, s.theme, s.people, s.notion_id, s.dont_share, to_char(s.recorded_on, 'YYYY-MM-DD') as recorded_on,
            s.created_at, s.updated_at, s.published_at, ph.thumb_key
       from stories s left join photos ph on ph.id = s.hero_photo_id and ph.deleted_at is null
      where s.deleted_at is null`);
  const out: Record<StoryTab, MyStoryRow[]> = { draft: [], published: [], private: [] };
  const sorted = [...rows].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at));
  for (const r of sorted) {
    const tab: StoryTab = r.status === "published" ? "published" : r.status === "private" ? "private" : "draft";
    const from = r.notion_id ? "Imported from Notion" : `Recorded ${fmtDay(r.recorded_on ?? r.created_at)}`;
    const meta = tab === "published" ? [themeLabel(r.theme), `Published ${fmtDay(r.published_at)}`].filter(Boolean).join(" · ")
      : tab === "private" && r.dont_share ? "Imported from Notion · marked don’t share" : from;
    const needs = tab === "draft" ? [!r.title.trim() && "title", !r.theme && "theme", !(r.people ?? []).length && "people"].filter((x): x is string => !!x) : [];
    out[tab].push({ id: r.id, tab, title: r.title, question: r.question, thumbUrl: r.thumb_key ? await signGet(r.thumb_key) : null, meta, needs });
  }
  const pubAt = new Map(rows.map((r) => [r.id, r.published_at ? +new Date(r.published_at) : 0]));
  out.published.sort((a, b) => (pubAt.get(b.id) ?? 0) - (pubAt.get(a.id) ?? 0));
  return out;
}

/** A photo as the form shows it. */
export type PhotoRef = { id: number; url: string | null };

export async function photoRefs(ids: number[]): Promise<Map<number, PhotoRef>> {
  const list = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  if (!list.length) return new Map();
  const rows = await q<{ id: number; thumb_key: string }>(`select id, thumb_key from photos where id = any($1::int[]) and deleted_at is null`, [list]);
  return new Map(await Promise.all(rows.map(async (r) => [r.id, { id: r.id, url: await signGet(r.thumb_key) }] as const)));
}

/** The answer as editor blocks: text, then photo, text, photo, text... (always text first and last). */
export type EditBlock =
  | { kind: "text"; text: string }
  | { kind: "photo"; photoId: number; url: string | null; caption: string }
  | { kind: "image"; key: string; url: string | null; caption: string };

export type StoryForm = {
  id: number | null; status: StoryTab; title: string; question: string; blocks: EditBlock[];
  hero: { id: number; url: string | null } | null; heroCaption: string; recordedOn: string;
  people: number[]; theme: string; occasion: number | null; decade: number | null; pinned: boolean;
};

export async function storyForm(id: number | null): Promise<StoryForm | null> {
  const today = todayNY();
  if (id === null)
    return { id: null, status: "draft", title: "", question: "", blocks: [{ kind: "text", text: "" }], hero: null, heroCaption: "", recordedOn: today,
      people: [], theme: "", occasion: null, decade: null, pinned: false };
  const [r] = await q<{
    id: number; status: string; title: string; question: string; body: string; hero_photo_id: number | null; hero_caption: string | null;
    recorded_on: string | null; people: number[]; theme: string | null; occasions: number[]; decades: number[];
  }>(`select id, status, title, question, body, hero_photo_id, hero_caption, to_char(recorded_on, 'YYYY-MM-DD') as recorded_on, people, theme, occasions, decades
        from stories where id = $1 and deleted_at is null`, [id]);
  if (!r) return null;
  const parsed = parseBody(r.body);
  const refs = await photoRefs([...parsed.flatMap((b) => (b.kind === "photo" ? [b.photoId] : [])), ...(r.hero_photo_id ? [r.hero_photo_id] : [])]);
  const blocks: EditBlock[] = [{ kind: "text", text: "" }];
  for (const b of parsed) {
    const last = blocks[blocks.length - 1];
    if (b.kind === "p") {
      if (last.kind === "text") last.text = last.text ? `${last.text}\n\n${b.text}` : b.text;
      else blocks.push({ kind: "text", text: b.text });
      continue;
    }
    if (last.kind !== "text") blocks.push({ kind: "text", text: "" });
    blocks.push(b.kind === "photo"
      ? { kind: "photo", photoId: b.photoId, url: refs.get(b.photoId)?.url ?? null, caption: b.caption }
      : { kind: "image", key: b.key, url: await signGet(b.key), caption: b.caption });
  }
  if (blocks[blocks.length - 1].kind !== "text") blocks.push({ kind: "text", text: "" });
  const [pin] = await q<{ value: string | null }>(`select value from settings where key = 'story_pin'`).catch(() => []);
  return {
    id: r.id, status: r.status === "published" ? "published" : r.status === "private" ? "private" : "draft",
    title: r.title, question: r.question, blocks,
    hero: r.hero_photo_id ? { id: r.hero_photo_id, url: refs.get(r.hero_photo_id)?.url ?? null } : null, heroCaption: r.hero_caption ?? "",
    recordedOn: r.recorded_on ?? today, people: r.people ?? [], theme: r.theme ?? "",
    occasion: r.occasions?.[0] ?? null, decade: r.decades?.[0] ?? null, pinned: Number(pin?.value) === r.id,
  };
}

/** Family profiles for "Add person", in family order. Never Dunya. */
export async function storyPeopleOptions() {
  const { listPeople } = await import("./data");
  const [people, dunya] = await Promise.all([listPeople(), findDunya()]);
  return people.filter((p) => p.id !== dunya?.id).map((p) => ({ id: p.id, name: displayName(p.name), aliases: p.aliases, avatarUrl: p.avatar_url, inMemory: p.in_memory }));
}

/** Photos for the picker: a search across captions, titles, people and occasions, or one person's photos. */
export async function pickerPhotos(search: string, personId: number | null): Promise<PhotoRef[]> {
  const term = search.trim().slice(0, 100);
  const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await q<{ id: number; thumb_key: string }>(
    `select ph.id, ph.thumb_key from photos ph
      where ph.deleted_at is null
        and ($1::int is null or exists (select 1 from photo_people pp where pp.photo_id = ph.id and pp.person_id = $1))
        and ($2 = '' or ph.title ilike $3 or ph.caption ilike $3 or ph.decade::text || 's' ilike $3 or ph.year::text = $2
             or exists (select 1 from photo_people pp join people pe on pe.id = pp.person_id
                         where pp.photo_id = ph.id and pe.deleted_at is null and (pe.name ilike $3 or array_to_string(pe.aliases, ' ') ilike $3))
             or exists (select 1 from photo_occasions po join occasions o on o.id = po.occasion_id where po.photo_id = ph.id and o.name ilike $3))
      order by coalesce(ph.taken_on, make_date(coalesce(ph.year, 1900), coalesce(ph.month, 1), 1)) desc nulls last, ph.id desc
      limit 120`,
    [personId, term, like]);
  return Promise.all(rows.map(async (r) => ({ id: r.id, url: await signGet(r.thumb_key) })));
}
