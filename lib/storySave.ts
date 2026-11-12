import { NextResponse } from "next/server";
import { getSession, isAdmin } from "./auth";
import { q } from "./db";
import { findDunya } from "./featured";
import { THEMES } from "./stories";

/** Story admin routes answer anyone but Mary with a plain not-found, so nothing hints the pages exist. */
export async function adminOr404() {
  const s = await getSession();
  return s && isAdmin(s) ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export type SaveBody = {
  title?: string; question?: string; body?: string; heroPhotoId?: number | null; heroCaption?: string | null; theme?: string | null;
  people?: number[]; occasions?: number[]; decades?: number[]; status?: "draft" | "published" | "private"; recordedOn?: string | null;
};
const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);
const STATUSES = ["draft", "published", "private"];

/** Words in the answer, not counting photo lines. */
const hasAnswer = (body: string) => body.split(/\n\s*\n/).some((c) => c.trim() && !/^\[(photo \d+|image [^\]]+)\]/i.test(c.trim()));

/**
 * Creates (id null) or saves a story. Publishing needs a title, the answer, and a theme. Dunya is never saved as a
 * tagged person. A private story is never published; turning one private takes it out of In Her Words.
 */
export async function saveStory(id: number | null, b: SaveBody): Promise<NextResponse> {
  let cur = { status: "draft", title: "", theme: null as string | null, body: "" };
  if (id !== null) {
    const [row] = await q<typeof cur>(`select status, title, theme, body from stories where id = $1 and deleted_at is null`, [id]);
    if (!row) return NextResponse.json({ error: "That story isn't here anymore." }, { status: 404 });
    cur = row;
  }
  const title = b.title !== undefined ? String(b.title).trim().slice(0, 200) : cur.title;
  const theme = b.theme !== undefined ? (THEMES.some((t) => t.slug === b.theme) ? b.theme! : null) : cur.theme;
  const body = b.body !== undefined ? String(b.body).replace(/\r\n/g, "\n").slice(0, 200_000) : cur.body;
  const status = b.status && STATUSES.includes(b.status) ? b.status : cur.status;
  if (status === "published") {
    const missing = !title ? "title" : !hasAnswer(body) ? "answer" : !theme ? "theme" : null;
    if (missing) return NextResponse.json({ error: `Add ${missing === "answer" ? "her answer" : `a ${missing}`} to publish.`, missing }, { status: 400 });
  }
  let hero: number | null | undefined = undefined;
  if (b.heroPhotoId !== undefined) {
    hero = b.heroPhotoId ? Number(b.heroPhotoId) : null;
    if (hero) {
      const [ph] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [hero]);
      if (!ph) return NextResponse.json({ error: "That photo isn't on the site anymore." }, { status: 400 });
    }
  }
  const dunya = await findDunya();
  const people = b.people !== undefined ? ids(b.people).filter((p) => p !== dunya?.id) : null;
  const decades = b.decades !== undefined ? ids(b.decades).filter((d) => d % 10 === 0 && d >= 1900 && d <= 2100) : null;
  const occasions = b.occasions !== undefined ? ids(b.occasions) : null;
  const recorded = b.recordedOn !== undefined ? (b.recordedOn && /^\d{4}-\d{2}-\d{2}$/.test(b.recordedOn) ? b.recordedOn : null) : undefined;
  const question = b.question !== undefined ? String(b.question).trim().slice(0, 2000) : null;
  const heroCaption = b.heroCaption ? String(b.heroCaption).trim().slice(0, 300) : null;

  if (id === null) {
    const [row] = await q<{ id: number }>(
      `insert into stories (title, theme, status, question, body, hero_photo_id, hero_caption, people, occasions, decades, recorded_on, published_at)
       values ($1, $2, $3, coalesce($4, ''), $5, $6, $7, coalesce($8::int[], '{}'), coalesce($9::int[], '{}'), coalesce($10::int[], '{}'), coalesce($11::date, current_date),
               case when $3 = 'published' then now() end)
       returning id`,
      [title, theme, status, question, body, hero ?? null, heroCaption, people, occasions, decades, recorded ?? null]);
    return NextResponse.json({ ok: true, id: row.id, status });
  }
  await q(
    `update stories set title = $2, theme = $3, status = $4, body = $5,
            question = coalesce($6, question),
            hero_photo_id = case when $7::boolean then $8::int else hero_photo_id end,
            hero_caption = case when $9::boolean then $10 else hero_caption end,
            people = coalesce($11::int[], people), occasions = coalesce($12::int[], occasions), decades = coalesce($13::int[], decades),
            recorded_on = case when $14::boolean then $15::date else recorded_on end,
            published_at = case when $4 = 'published' then coalesce(published_at, now()) else published_at end,
            updated_at = now()
      where id = $1`,
    [id, title, theme, status, body, question, hero !== undefined, hero ?? null, b.heroCaption !== undefined, heroCaption,
      people, occasions, decades, recorded !== undefined, recorded ?? null]);
  // A story that isn't published can't stay pinned as featured.
  if (status !== "published") await q(`delete from settings where key = 'story_pin' and value = $1`, [String(id)]);
  return NextResponse.json({ ok: true, id, status });
}
