import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const b = (await req.json()) as { title?: string; date?: string; timeNote?: string; location?: string; notes?: string };
  const title = b.title?.trim().slice(0, 120);
  if (!title) return badRequest("Give the gathering a name.");
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return badRequest("Choose a date.");
  await q(
    `insert into gatherings (title, date, time_note, location, notes, created_by_device, created_by_name) values ($1,$2,$3,$4,$5,$6,$7)`,
    [title, b.date, b.timeNote?.trim() || null, b.location?.trim() || null, b.notes?.trim() || null, s.did, s.name],
  );
  return NextResponse.json({ ok: true });
}
