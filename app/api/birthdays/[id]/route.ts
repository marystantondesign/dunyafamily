import { NextResponse } from "next/server";
import { canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const [b] = await q<{ created_by_device: string | null }>(`select created_by_device from birthdays where id = $1 and deleted_at is null`, [id]);
  if (!b) return NextResponse.json({ ok: true });
  if (!canRemove(s, b.created_by_device)) return forbidden();
  await q(`update birthdays set deleted_at = now(), deleted_by_name = $2 where id = $1`, [id, s?.name ?? null]);
  return NextResponse.json({ ok: true });
}
