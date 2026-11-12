import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

/** "I'd want a copy" of the printed book: on or off for this profile. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Pick who you are first.");
  const { want } = (await req.json().catch(() => ({}))) as { want?: boolean };
  if (want) await q(`insert into story_book_requests (person_id) values ($1) on conflict do nothing`, [s.pid]);
  else await q(`delete from story_book_requests where person_id = $1`, [s.pid]);
  return NextResponse.json({ ok: true, want: !!want });
}
