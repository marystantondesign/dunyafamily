import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { isEmoji, reactToComment } from "@/lib/comments";
import { q } from "@/lib/db";

/** React to a comment with one emoji. Anyone can. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const raw = ((await req.json().catch(() => ({}))) as { emoji?: string }).emoji ?? "";
  if (!isEmoji(raw)) return badRequest("Reactions are one emoji.");
  const [c] = await q(`select 1 from photo_comments where id = $1 and deleted_at is null`, [id]);
  if (!c) return badRequest("That comment isn't here anymore.");
  return NextResponse.json({ on: await reactToComment(id, raw.trim(), s) });
}
