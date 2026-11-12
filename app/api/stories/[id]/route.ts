import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { findDunya } from "@/lib/featured";
import { THEMES } from "@/lib/stories";

type Body = {
  title?: string; question?: string; body?: string; heroPhotoId?: number | null; heroCaption?: string | null; theme?: string | null;
  people?: number[]; occasions?: number[]; decades?: number[]; status?: "draft" | "published";
};
const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : []);

/** Mary only: save a story. Publishing needs a title and a theme. Dunya is never saved as a tagged person. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return forbidden();
  const id = Number((await params).id);
  const [cur] = await q<{ status: string; title: string; theme: string | null; published_at: string | null }>(
    `select status, title, theme, published_at from stories where id = $1 and deleted_at is null`, [id]);
  if (!cur) return badRequest("That story isn't here anymore.");
  const b = (await req.json().catch(() => ({}))) as Body;
  const title = b.title !== undefined ? String(b.title).trim().slice(0, 200) : cur.title;
  const theme = b.theme !== undefined ? (THEMES.some((t) => t.slug === b.theme) ? b.theme : null) : cur.theme;
  const status = b.status ?? cur.status;
  if (status === "published" && (!title || !theme)) return badRequest("Add a title and choose a theme before publishing.");
  let hero: number | null | undefined = undefined;
  if (b.heroPhotoId !== undefined) {
    hero = b.heroPhotoId ? Number(b.heroPhotoId) : null;
    if (hero) {
      const [ph] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [hero]);
      if (!ph) return badRequest("That photo number isn't on the site.");
    }
  }
  const dunya = await findDunya();
  const people = b.people !== undefined ? ids(b.people).filter((p) => p !== dunya?.id) : undefined;
  const decades = b.decades !== undefined ? ids(b.decades).filter((d) => d % 10 === 0 && d >= 1900 && d <= 2100) : undefined;
  await q(
    `update stories set title = $2, theme = $3, status = $4,
            question = coalesce($5, question), body = coalesce($6, body),
            hero_photo_id = case when $7::boolean then $8::int else hero_photo_id end,
            hero_caption = case when $9::boolean then $10 else hero_caption end,
            people = coalesce($11::int[], people), occasions = coalesce($12::int[], occasions), decades = coalesce($13::int[], decades),
            published_at = case when $4 = 'published' then coalesce(published_at, now()) else published_at end,
            updated_at = now()
      where id = $1`,
    [id, title, theme, status, b.question !== undefined ? String(b.question).trim().slice(0, 500) : null, b.body !== undefined ? String(b.body).slice(0, 100_000) : null,
      hero !== undefined, hero ?? null, b.heroCaption !== undefined, b.heroCaption ? String(b.heroCaption).trim().slice(0, 300) : null,
      people ?? null, b.occasions !== undefined ? ids(b.occasions) : null, decades ?? null]);
  return NextResponse.json({ ok: true });
}

/** Mary only: remove a story (it can be restored from the database). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return forbidden();
  await q(`update stories set deleted_at = now() where id = $1`, [Number((await params).id)]);
  return NextResponse.json({ ok: true });
}
