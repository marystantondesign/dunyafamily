import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const b = (await req.json()) as { title?: string; date?: string; endDate?: string | null; timeNote?: string; location?: string; notes?: string };
  const title = b.title?.trim().slice(0, 120);
  if (!title) return badRequest("Give the gathering a name.");
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return badRequest("Choose a date.");
  // Several days: the last day comes after the first, and no more than two months later.
  let end: string | null = null;
  if (b.endDate && b.endDate !== b.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.endDate) || b.endDate < b.date) return badRequest("The last day has to come after the first.");
    if ((Date.parse(b.endDate) - Date.parse(b.date)) / 86_400_000 > 62) return badRequest("Pick a shorter stretch of days.");
    end = b.endDate;
  }
  await q(
    `insert into gatherings (title, date, end_date, time_note, location, notes, created_by_device, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [title, b.date, end, b.timeNote?.trim() || null, b.location?.trim() || null, b.notes?.trim() || null, s.did, s.name],
  );
  return NextResponse.json({ ok: true });
}
