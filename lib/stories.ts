import { isAdmin } from "./auth";
import { q } from "./db";
import { findDunya } from "./featured";
import { inFamilyOrder } from "./familyOrder";
import { displayName } from "./names";
import { signGet } from "./r2";
import type { Session } from "./session";

/** The six themes, in this order everywhere. The slug is what goes in the URL (?theme=family). */
export const THEMES = [
  { slug: "growing-up", label: "Growing up" },
  { slug: "family", label: "Family" },
  { slug: "school-and-work", label: "School and work" },
  { slug: "love-and-marriage", label: "Love and marriage" },
  { slug: "raising-kids", label: "Raising kids" },
  { slug: "favorites-and-advice", label: "Favorites and advice" },
] as const;
export const themeLabel = (slug: string | null) => THEMES.find((t) => t.slug === slug)?.label ?? "";

/** About 200 words a minute, rounded up, at least 1. */
export const readingTime = (body: string) => Math.max(1, Math.ceil(body.trim().split(/\s+/).filter(Boolean).length / 200));

/** Her answer as blocks: paragraphs, and photos (a site photo by id, or an image brought over from Notion). */
export type Block = { kind: "p"; text: string } | { kind: "photo"; photoId: number; caption: string } | { kind: "image"; key: string; caption: string };
const PHOTO = /^\[photo (\d+)\]\s*(.*)$/i;
const IMAGE = /^\[image ((?:stories|submissions)\/[\w.-]+)\]\s*(.*)$/i;
export function parseBody(body: string): Block[] {
  return body.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean).map((c) => {
    const p = c.match(PHOTO);
    if (p) return { kind: "photo" as const, photoId: Number(p[1]), caption: p[2].trim() };
    const i = c.match(IMAGE);
    if (i) return { kind: "image" as const, key: i[1], caption: i[2].trim() };
    return { kind: "p" as const, text: c.replace(/\n/g, " ") };
  });
}
/** Words only, for reading time (photo lines don't count). */
const wordsOf = (body: string) => parseBody(body).map((b) => (b.kind === "p" ? b.text : "")).join(" ");

type Row = {
  id: number; question: string; title: string; body: string; hero_photo_id: number | null; hero_caption: string | null; theme: string | null;
  people: number[]; occasions: number[]; decades: number[]; status: string; published_at: string | null; notion_id: string | null; thumb_key: string | null; updated_at: string;
};
const COLS = `s.id, s.question, s.title, s.body, s.hero_photo_id, s.hero_caption, s.theme, s.people, s.occasions, s.decades, s.status, s.published_at, s.notion_id, s.updated_at, ph.thumb_key`;
const FROM = `from stories s left join photos ph on ph.id = s.hero_photo_id and ph.deleted_at is null where s.deleted_at is null`;

export type StoryCard = {
  id: number; title: string; theme: string; themeLabel: string; minutes: number; photoUrl: string | null;
  people: number[]; occasions: number[]; decades: number[];
  /** The start of her answer, for the featured card. */
  excerpt: string;
};

/** Dunya is never a tagged person in a story: every story is hers. */
async function withoutDunya(ids: number[]) {
  const d = await findDunya();
  return d ? ids.filter((x) => x !== d.id) : ids;
}

async function card(r: Row): Promise<StoryCard> {
  return {
    id: r.id, title: r.title, theme: r.theme ?? "", themeLabel: themeLabel(r.theme), minutes: readingTime(wordsOf(r.body)),
    photoUrl: r.thumb_key ? await signGet(r.thumb_key) : null,
    people: await withoutDunya(r.people ?? []), occasions: r.occasions ?? [], decades: r.decades ?? [],
    excerpt: wordsOf(r.body).trim().slice(0, 600),
  };
}

/** Published stories, oldest published first (the order "Next story" follows). */
export async function publishedStories(): Promise<StoryCard[]> {
  const rows = await q<Row>(`select ${COLS} ${FROM} and s.status = 'published' order by s.published_at, s.id`).catch(() => []);
  return Promise.all(rows.map(card));
}

export async function storyCount() {
  const [r] = await q<{ n: number }>(`select count(*)::int as n from stories where deleted_at is null and status = 'published'`).catch(() => [{ n: 0 }]);
  return r?.n ?? 0;
}

/**
 * The featured story: Mary's pin, or a different story on every visit (never the one shown last time on this
 * browser, which the page remembers in the df_feat cookie).
 */
export async function featuredStory(list: StoryCard[], lastId: number | null = null): Promise<StoryCard | null> {
  if (!list.length) return null;
  const [pin] = await q<{ value: string | null }>(`select value from settings where key = 'story_pin'`).catch(() => []);
  const pinned = list.find((s) => s.id === Number(pin?.value));
  if (pinned) return pinned;
  const pool = list.length > 1 ? list.filter((s) => s.id !== lastId) : list;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function storyPin(): Promise<number | null> {
  const [pin] = await q<{ value: string | null }>(`select value from settings where key = 'story_pin'`).catch(() => []);
  return Number(pin?.value) || null;
}

export type FilterPerson = { id: number; name: string; first: string; slug: string; avatarUrl: string | null; inMemory: boolean; count: number };

/** People mentioned in at least one published story, in family order, with how many stories mention them. Never Dunya. */
export async function storyPeople(list: StoryCard[]): Promise<FilterPerson[]> {
  const counts = new Map<number, number>();
  for (const s of list) for (const p of s.people) counts.set(p, (counts.get(p) ?? 0) + 1);
  if (!counts.size) return [];
  const rows = await q<{ id: number; name: string; in_memory: boolean; thumb_key: string | null }>(
    `select pe.id, pe.name, pe.in_memory, ph.thumb_key from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where pe.id = any($1::int[]) and pe.deleted_at is null`, [[...counts.keys()]]);
  const people = await Promise.all(rows.map(async (r) => {
    const name = displayName(r.name);
    return { id: r.id, name, first: name.split(/\s+/)[0], slug: "", avatarUrl: r.thumb_key ? await signGet(r.thumb_key) : null, inMemory: !!r.in_memory, count: counts.get(r.id) ?? 0 };
  }));
  // URL names: first names, lowercased, unless two people share one.
  for (const p of people) {
    const base = p.first.toLowerCase().replace(/[^a-z0-9]+/g, "");
    p.slug = people.filter((o) => o.first.toLowerCase().replace(/[^a-z0-9]+/g, "") === base).length > 1 ? `${base}-${p.id}` : base || String(p.id);
  }
  return inFamilyOrder(people);
}

export type StoryView = StoryCard & {
  question: string; heroCaption: string | null; heroUrl: string | null; blocks: (Block & { url?: string | null })[];
  tagged: FilterPerson[]; next: StoryCard | null; status: string;
};

/** One story, ready to read. Drafts only for the admin. */
export async function storyPage(id: number, s: Session | null): Promise<StoryView | null> {
  const [r] = await q<Row & { original_key: string | null }>(`select ${COLS}, ph.original_key ${FROM} and s.id = $1`, [id]).catch(() => []);
  if (!r || (r.status !== "published" && !isAdmin(s))) return null;
  const c = await card(r);
  const blocks = await Promise.all(parseBody(r.body).map(async (b) => {
    if (b.kind === "photo") {
      const [ph] = await q<{ original_key: string; thumb_key: string }>(`select original_key, thumb_key from photos where id = $1 and deleted_at is null`, [b.photoId]);
      return { ...b, url: ph ? await signGet(ph.original_key) : null };
    }
    if (b.kind === "image") return { ...b, url: await signGet(b.key) };
    return b;
  }));
  const all = await publishedStories();
  const at = all.findIndex((x) => x.id === id);
  const next = all.length > 1 ? all[(at + 1) % all.length] : null;
  const people = await storyPeople(all);
  // A draft (admin preview) may tag people no published story mentions yet.
  const tagged = c.people.map((pid) => people.find((p) => p.id === pid)).filter((p): p is FilterPerson => !!p);
  return {
    ...c, status: r.status, question: r.question, heroCaption: r.hero_caption, heroUrl: r.original_key ? await signGet(r.original_key) : null,
    blocks: blocks.filter((b) => b.kind === "p" || b.url), tagged, next: next && next.id !== id ? next : null,
  };
}

/** "I'd want a copy" of the printed book, for this profile. */
export async function wantsBook(pid: number | undefined) {
  if (!pid) return false;
  const [r] = await q(`select 1 from story_book_requests where person_id = $1`, [pid]).catch(() => []);
  return !!r;
}

/** For the admin: every story, newest changed first. */
export async function allStories() {
  return q<{ id: number; title: string; question: string; status: string; theme: string | null; notion_id: string | null; updated_at: string; published_at: string | null }>(
    `select id, title, question, status, theme, notion_id, updated_at, published_at from stories where deleted_at is null order by (status = 'draft') desc, updated_at desc, id desc`);
}

/** Everyone who tapped "I'd want a copy", newest first. */
export async function bookRequests() {
  const rows = await q<{ id: number; name: string; in_memory: boolean; thumb_key: string | null; created_at: string }>(
    `select pe.id, pe.name, pe.in_memory, ph.thumb_key, r.created_at from story_book_requests r
       join people pe on pe.id = r.person_id and pe.deleted_at is null
       left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      order by r.created_at desc`);
  return Promise.all(rows.map(async (r) => ({
    id: r.id, name: displayName(r.name), inMemory: !!r.in_memory, avatarUrl: r.thumb_key ? await signGet(r.thumb_key) : null,
    at: new Date(r.created_at).toISOString(),
  })));
}

export async function storyForEdit(id: number) {
  const [r] = await q<Row>(`select ${COLS} ${FROM} and s.id = $1`, [id]);
  return r ?? null;
}
