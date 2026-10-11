import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { isEmoji } from "@/lib/comments";
import { q } from "@/lib/db";

/** React with any emoji; the same emoji again takes it back. One of each per device. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const raw = ((await req.json().catch(() => ({}))) as { emoji?: string }).emoji ?? "";
  if (!isEmoji(raw)) return badRequest("Reactions are one emoji.");
  const emoji = raw.trim();
  const [photo] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) return badRequest("That photo isn't here anymore.");
  const gone = await q(`delete from photo_reactions where photo_id = $1 and emoji = $2 and created_by_device = $3 returning 1`, [id, emoji, s.did]);
  if (!gone.length)
    await q(`insert into photo_reactions (photo_id, emoji, created_by_device, author_name, author_pid) values ($1, $2, $3, $4, $5)`, [id, emoji, s.did, s.name, s.pid ?? null]);
  return NextResponse.json({ on: !gone.length });
}
