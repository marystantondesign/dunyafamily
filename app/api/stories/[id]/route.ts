import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { adminOr404, saveStory, type SaveBody } from "@/lib/storySave";

/** Mary only: save a story (also autosave). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const no = await adminOr404();
  if (no) return no;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return saveStory(id, (await req.json().catch(() => ({}))) as SaveBody);
}

/** Mary only: remove a story (it can be restored from the database). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const no = await adminOr404();
  if (no) return no;
  await q(`update stories set deleted_at = now() where id = $1`, [Number((await params).id)]);
  return NextResponse.json({ ok: true });
}
