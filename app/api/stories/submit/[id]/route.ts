import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { adminOr404 } from "@/lib/storySave";

/** Mary only: remove a submitted story (soft delete; its photos stay in storage). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const no = await adminOr404();
  if (no) return no;
  await q(`update story_submissions set deleted_at = now() where id = $1`, [Number((await params).id)]);
  return NextResponse.json({ ok: true });
}
