import { NextResponse } from "next/server";
import { canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const [g] = await q<{ created_by_device: string | null }>(`select created_by_device from gatherings where id = $1 and deleted_at is null`, [id]);
  if (!g) return NextResponse.json({ ok: true });
  if (!canRemove(s, g.created_by_device)) return forbidden();
  await q(`update gatherings set deleted_at = now() where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
