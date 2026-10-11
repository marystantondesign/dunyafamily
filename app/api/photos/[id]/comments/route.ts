import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { addComment } from "@/lib/comments";
import { q } from "@/lib/db";

/** Leave a comment on a photo. Anyone can. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const [photo] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) return badRequest("That photo isn't here anymore.");
  const { body, replyTo } = (await req.json().catch(() => ({}))) as { body?: string; replyTo?: number };
  const cid = await addComment(id, body ?? "", s, Number(replyTo) || null);
  return typeof cid === "number" ? NextResponse.json({ id: cid }) : badRequest(cid);
}
