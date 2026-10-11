import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { validMonthDay } from "@/lib/people";
import { capitalizeName } from "@/lib/tags";

/** Add someone to the family, with an optional birthday. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const body = (await req.json()) as { name?: string; month?: number | null; day?: number | null; year?: number | null; address?: string | null; shareAddress?: boolean };
  const name = capitalizeName((body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80));
  if (!name) return badRequest("Add a name.");
  const m = Number(body.month) || 0, d = Number(body.day) || 0;
  if ((m || d) && !validMonthDay(m, d)) return badRequest("That birthday doesn't exist.");
  const y = body.year ? Number(body.year) : null;
  if (y !== null && (!Number.isInteger(y) || y < 1850 || y > new Date().getFullYear())) return badRequest("That birth year doesn't look right.");
  const address = (body.address ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).join("\n").slice(0, 500) || null;

  const [existing] = await q<{ id: number }>(
    `select id from people where deleted_at is null and (lower(name) = lower($1) or lower($1) = any(select lower(a) from unnest(aliases) a))`, [name]);
  if (existing) return NextResponse.json({ error: `${name} is already in the family.`, id: existing.id }, { status: 409 });

  const [row] = await q<{ id: number }>(
    `insert into people (name, created_by_device, created_by_name, address, address_updated_at, address_by_device, share_address)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [name, s.did, s.name, address, address ? new Date().toISOString() : null, address ? s.did : null, body.shareAddress !== false]);
  if (m && d)
    await q(`insert into birthdays (person_id, month, day, year, created_by_device, created_by_name) values ($1,$2,$3,$4,$5,$6)`, [row.id, m, d, y, s.did, s.name]);
  return NextResponse.json({ id: row.id });
}
