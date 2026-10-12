import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { displayName } from "@/lib/names";
import { validMonthDay } from "@/lib/people";
import { resolvePeople } from "@/lib/tags";

/**
 * Add an anniversary (one or two people) or a day to remember from the calendar. Anyone can add one, and
 * whoever added it can remove it. A typed new name adds that person, same as birthdays.
 */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { kind?: string; people?: (number | string)[]; note?: string; month?: number; day?: number };
  const kind = b.kind === "anniversary" ? "anniversary" : b.kind === "remembrance" ? "remembrance" : null;
  if (!kind) return badRequest("Choose what kind of day it is.");
  const m = Number(b.month), d = Number(b.day);
  if (!validMonthDay(m, d)) return badRequest("That date doesn't exist.");
  const ids = await resolvePeople((b.people ?? []).slice(0, kind === "anniversary" ? 2 : 1), s);
  if (!ids.length) return badRequest(kind === "anniversary" ? "Choose whose anniversary it is." : "Choose who it's for.");
  const note = (b.note ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  let label = note;
  if (kind === "anniversary" && ids[1]) {
    const [other] = await q<{ name: string }>(`select name from people where id = $1`, [ids[1]]);
    label = other ? `With ${displayName(other.name)}` : "";
  }
  if (kind === "remembrance" && !label) {
    const [p] = await q<{ name: string }>(`select name from people where id = $1`, [ids[0]]);
    label = p ? `Remembering ${displayName(p.name)}` : "";
  }
  await q(`insert into person_dates (person_id, kind, label, month, day, created_by_device, created_by_name) values ($1,$2,$3,$4,$5,$6,$7)`,
    [ids[0], kind, label, m, d, s.did, s.name]);
  return NextResponse.json({ ok: true });
}
