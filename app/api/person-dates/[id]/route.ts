import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { DATE_KINDS, validMonthDay, type DateKind } from "@/lib/people";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: number) {
  const [row] = await q<{ created_by_device: string | null }>(`select created_by_device from person_dates where id = $1 and deleted_at is null`, [id]);
  return row;
}

/** Changing a date is for whoever added it, or the admin. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const row = await load(id);
  if (!row) return NextResponse.json({ error: "That date isn't here anymore." }, { status: 404 });
  if (!canRemove(s, row.created_by_device)) return forbidden();
  const body = (await req.json()) as { kind?: string; label?: string; month?: number; day?: number; year?: number | null };
  const kind = (DATE_KINDS as readonly string[]).includes(body.kind ?? "") ? (body.kind as DateKind) : "other";
  const label = (body.label ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const m = Number(body.month), d = Number(body.day);
  const year = body.year ? Number(body.year) : null;
  if (kind === "other" && !label) return badRequest("Add a short name for the date.");
  if (!validMonthDay(m, d)) return badRequest("That date doesn't exist.");
  if (year !== null && (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear() + 5)) return badRequest("That year doesn't look right.");
  await q(`update person_dates set kind = $1, label = $2, month = $3, day = $4, year = $5 where id = $6`, [kind, label, m, d, year, id]);
  return NextResponse.json({ ok: true });
}

/** Removing a date is for whoever added it, or the admin. Soft delete, so it can be restored. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const row = await load(id);
  if (!row) return NextResponse.json({ ok: true });
  if (!canRemove(s, row.created_by_device)) return forbidden();
  await q(`update person_dates set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s?.name ?? null]);
  return NextResponse.json({ ok: true });
}
