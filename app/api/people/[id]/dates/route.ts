import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { DATE_KINDS, validMonthDay, type DateKind } from "@/lib/people";

/** Add an anniversary, remembrance, or other important date. Anyone can add one. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const personId = Number((await params).id);
  const body = (await req.json()) as { kind?: string; label?: string; month?: number; day?: number; year?: number | null };
  const kind = (DATE_KINDS as readonly string[]).includes(body.kind ?? "") ? (body.kind as DateKind) : "other";
  const label = (body.label ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const m = Number(body.month), d = Number(body.day);
  const year = body.year ? Number(body.year) : null;
  if (kind === "other" && !label) return badRequest("Add a short name for the date, like Graduation.");
  if (!validMonthDay(m, d)) return badRequest("That date doesn't exist.");
  if (year !== null && (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear() + 5)) return badRequest("That year doesn't look right.");
  const [person] = await q(`select 1 from people where id = $1 and deleted_at is null`, [personId]);
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  await q(
    `insert into person_dates (person_id, kind, label, month, day, year, created_by_device, created_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [personId, kind, label, m, d, year, s.did, s.name],
  );
  return NextResponse.json({ ok: true });
}
