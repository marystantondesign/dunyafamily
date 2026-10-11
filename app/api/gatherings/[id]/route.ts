import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const [g] = await q<{ created_by_device: string | null }>(`select created_by_device from gatherings where id = $1 and deleted_at is null`, [id]);
  return g;
}

/** Editing a gathering is for whoever added it, or the admin. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const g = await load(id);
  if (!g) return NextResponse.json({ error: "That gathering isn't here anymore." }, { status: 404 });
  if (!canRemove(s, g.created_by_device)) return forbidden();
  const b = (await req.json()) as { title?: string; date?: string; timeNote?: string; location?: string; notes?: string };
  const title = b.title?.trim().slice(0, 120);
  if (!title) return badRequest("Give the gathering a name.");
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return badRequest("Choose a date.");
  await q(
    `update gatherings set title = $1, date = $2, time_note = $3, location = $4, notes = $5 where id = $6`,
    [title, b.date, b.timeNote?.trim().slice(0, 80) || null, b.location?.trim().slice(0, 200) || null, b.notes?.trim().slice(0, 1000) || null, id],
  );
  return NextResponse.json({ ok: true });
}

/** Deleting is a soft delete, so the admin can restore it. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const g = await load(id);
  if (!g) return NextResponse.json({ ok: true });
  if (!canRemove(s, g.created_by_device)) return forbidden();
  await q(`update gatherings set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s?.name ?? null]);
  return NextResponse.json({ ok: true });
}
