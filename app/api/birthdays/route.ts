import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { resolvePeople } from "@/lib/tags";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const { person, month, day } = (await req.json()) as { person: number | string; month: number; day: number };
  const m = Number(month), d = Number(day);
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31) || new Date(2000, m - 1, d).getMonth() !== m - 1)
    return badRequest("That date doesn't exist.");
  const [pid] = await resolvePeople([person], s);
  if (!pid) return badRequest("Choose who the birthday is for.");
  const [existing] = await q(`select 1 from birthdays where person_id = $1 and deleted_at is null`, [pid]);
  if (existing) return NextResponse.json({ error: "There's already a birthday saved for them." }, { status: 409 });
  await q(`insert into birthdays (person_id, month, day, created_by_device, created_by_name) values ($1,$2,$3,$4,$5)`, [pid, m, d, s.did, s.name]);
  return NextResponse.json({ ok: true });
}
