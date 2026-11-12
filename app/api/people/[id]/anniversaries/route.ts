import { NextResponse } from "next/server";
import { badRequest, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { validMonthDay } from "@/lib/people";

type Ann = { id?: number | null; month?: number; day?: number; year?: number | string | null; label?: string; onCalendar?: boolean };

/**
 * Edit your details: the whole list of someone's anniversaries at once (the person themselves or the admin).
 * Existing ones are updated in place, new ones added, and ones left out are removed (soft delete, restorable).
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const personId = Number((await params).id);
  if (!isAdmin(s) && s.pid !== personId) return NextResponse.json({ error: "Only they or Mary can change these." }, { status: 403 });
  const list = ((await req.json().catch(() => ({}))) as { anniversaries?: Ann[] }).anniversaries ?? [];
  if (list.length > 40) return badRequest("That's too many dates.");
  const clean = [];
  for (const a of list) {
    const m = Number(a.month), d = Number(a.day);
    if (!validMonthDay(m, d)) return badRequest("Choose a month and day for each anniversary.");
    const year = a.year === null || a.year === undefined || a.year === "" ? null : Number(a.year);
    if (year !== null && (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear() + 5)) return badRequest("One of the years doesn't look right.");
    clean.push({ id: Number(a.id) || null, month: m, day: d, year, label: String(a.label ?? "").trim().replace(/\s+/g, " ").slice(0, 80), on: a.onCalendar !== false });
  }
  const existing = (await q<{ id: number }>(`select id from person_dates where person_id = $1 and deleted_at is null`, [personId])).map((r) => r.id);
  const keep = new Set(clean.map((c) => c.id).filter((id): id is number => !!id && existing.includes(id)));
  const gone = existing.filter((id) => !keep.has(id));
  if (gone.length) await q(`update person_dates set deleted_at = now(), deleted_by_name = $2 where id = any($1::int[])`, [gone, s.name ?? null]);
  for (const c of clean) {
    if (c.id && keep.has(c.id)) {
      await q(`update person_dates set label = $2, month = $3, day = $4, year = $5, on_calendar = $6 where id = $1`, [c.id, c.label, c.month, c.day, c.year, c.on]);
    } else {
      await q(`insert into person_dates (person_id, kind, label, month, day, year, on_calendar, created_by_device, created_by_name) values ($1, 'anniversary', $2, $3, $4, $5, $6, $7, $8)`,
        [personId, c.label, c.month, c.day, c.year, c.on, s.did, s.name]);
    }
  }
  return NextResponse.json({ ok: true });
}
