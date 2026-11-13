import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import { adminOr404 } from "@/lib/storySave";

/** Mary only: remove an occasion (soft delete; the photos and their links stay). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const no = await adminOr404();
  if (no) return no;
  const s = await getSession();
  await q(`update occasions set deleted_at = now(), deleted_by_name = $2 where id = $1 and deleted_at is null`, [Number((await params).id), s?.name ?? null]);
  return NextResponse.json({ ok: true });
}
