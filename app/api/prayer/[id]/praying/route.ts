import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { togglePraying } from "@/lib/prayer";

/** I'm praying. Tapping again takes it back. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const [r] = await q(`select 1 from prayer_requests where id = $1 and deleted_at is null and answered_at is null`, [id]);
  if (!r) return badRequest("That request isn't open anymore.");
  return NextResponse.json({ on: await togglePraying({ requestId: id }, s) });
}
