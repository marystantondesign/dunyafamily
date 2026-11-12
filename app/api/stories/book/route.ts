import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { adminOr404 } from "@/lib/storySave";

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

/** Mary only: take someone off the list ({ personId }). The bar shows for them again. */
export async function DELETE(req: Request) {
  const no = await adminOr404();
  if (no) return no;
  const { personId } = (await req.json().catch(() => ({}))) as { personId?: number };
  await q(`delete from story_book_requests where person_id = $1`, [Number(personId)]);
  return NextResponse.json({ ok: true });
}
