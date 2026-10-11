import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { EMOJI } from "@/lib/comments";
import { q } from "@/lib/db";

/** Tap an emoji to react; tap it again to take it back. One of each per device. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const { emoji } = (await req.json().catch(() => ({}))) as { emoji?: string };
  if (!emoji || !EMOJI.includes(emoji)) return badRequest("Pick one of the reactions.");
  const [photo] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) return badRequest("That photo isn't here anymore.");
  const gone = await q(`delete from photo_reactions where photo_id = $1 and emoji = $2 and created_by_device = $3 returning 1`, [id, emoji, s.did]);
  if (!gone.length)
    await q(`insert into photo_reactions (photo_id, emoji, created_by_device, author_name, author_pid) values ($1, $2, $3, $4, $5)`, [id, emoji, s.did, s.name, s.pid ?? null]);
  return NextResponse.json({ on: !gone.length });
}
