import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

/** Take a link out of the tree: whoever added it, or Mary. Both people stay. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const [r] = await q<{ id: number; created_by_device: string | null }>(
    `select id, created_by_device from relationships where id = $1 and deleted_at is null`, [Number((await params).id)]);
  if (!r) return badRequest("That's already been taken off.");
  if (!isAdmin(s)) return forbidden();
  await q(`update relationships set deleted_at = now(), deleted_by_name = $2 where id = $1`, [r.id, s?.name ?? null]);
  return NextResponse.json({ ok: true });
}
