import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { editComment } from "@/lib/comments";
import { q } from "@/lib/db";

/** Delete a comment: whoever wrote it, or Mary. It goes to Recently deleted. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const [c] = await q<{ id: number; created_by_device: string | null }>(
    `select id, created_by_device from photo_comments where id = $1 and deleted_at is null`, [Number((await params).id)]);
  if (!c) return badRequest("That comment is already gone.");
  if (!canRemove(s, c.created_by_device)) return forbidden();
  await q(`update photo_comments set deleted_at = now(), deleted_by_name = $2 where id = $1`, [c.id, s.name]);
  return NextResponse.json({ ok: true });
}

/** Edit a comment: whoever wrote it, or Mary. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const [c] = await q<{ id: number; created_by_device: string | null }>(
    `select id, created_by_device from photo_comments where id = $1 and deleted_at is null`, [Number((await params).id)]);
  if (!c) return badRequest("That comment isn't here anymore.");
  if (!canRemove(s, c.created_by_device)) return forbidden();
  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  const err = await editComment(c.id, body ?? "");
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}
