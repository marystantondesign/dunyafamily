import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { canClearFlag, setTaggingNeeded } from "@/lib/taggingNeeded";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const [p] = await q<{ uploaded_by_device: string; year: number | null; decade: number | null; caption: string | null; title: string | null;
    tagging_needed: boolean; tagging_needed_by: number | null; tagging_needed_by_device: string | null }>(
    `select uploaded_by_device, year, decade, caption, title, tagging_needed, tagging_needed_by, tagging_needed_by_device from photos where id = $1 and deleted_at is null`,
    [id],
  );
  return p;
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const p = await load(id);
  if (!p) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  if (!canRemove(s, p.uploaded_by_device)) return forbidden();
  // Soft delete, so Mary can restore anything removed by mistake.
  await q(`update photos set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s?.name ?? null]);
  return NextResponse.json({ ok: true });
}

/** Filling in a blank is adding, so anyone can. Changing an existing value is for the uploader or Mary. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const p = await load(id);
  if (!p) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const body = (await req.json()) as {
    year?: number | null; decade?: number | null; caption?: string | null; title?: string | null;
    /** everyone: "Yes, that's everyone" after tagging, which anyone can say. */
    taggingNeeded?: boolean; everyone?: boolean;
  };
  const owner = canRemove(s, p.uploaded_by_device);

  // Tagging needed: anyone can flag a photo. Clearing it is for whoever flagged it or the admin, or anyone who
  // has just tagged it and says that's everyone.
  if (typeof body.taggingNeeded === "boolean") {
    if (!body.taggingNeeded && p.tagging_needed && !body.everyone && !canClearFlag(s, { by: p.tagging_needed_by, byDevice: p.tagging_needed_by_device }))
      return NextResponse.json({ error: "Only the person who marked this, or Mary, can take it off. Tag who you know and the family will finish it." }, { status: 403 });
    await setTaggingNeeded(id, body.taggingNeeded, s);
    if (Object.keys(body).every((k) => k === "taggingNeeded" || k === "everyone")) return NextResponse.json({ ok: true });
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };

  if ("year" in body) {
    if (p.year !== null && !owner) return forbidden();
    const y = body.year ? Number(body.year) : null;
    if (y !== null && (y < 1850 || y > 2100)) return badRequest("That year doesn't look right.");
    set("year", y);
    set("decade", y ? Math.floor(y / 10) * 10 : p.decade);
  } else if ("decade" in body) {
    if (p.decade !== null && !owner) return forbidden();
    set("decade", body.decade ? Number(body.decade) : null);
  }
  if ("caption" in body) {
    if (p.caption && !owner) return forbidden();
    set("caption", body.caption?.trim().slice(0, 500) || null);
  }
  if ("title" in body) {
    if (p.title && !owner) return forbidden();
    set("title", body.title?.replace(/\s+/g, " ").trim().slice(0, 120) || null);
  }
  if (!sets.length) return badRequest("Nothing to change.");
  vals.push(id);
  await q(`update photos set ${sets.join(", ")} where id = $${vals.length}`, vals);
  return NextResponse.json({ ok: true });
}
