import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { rememberedToday, togglePraying } from "@/lib/prayer";

/** Praying for those who miss someone, on their day of remembrance. Each year starts fresh. */
export async function POST(_req: Request, { params }: { params: Promise<{ personId: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).personId);
  if (!(await rememberedToday(id))) return badRequest("Today isn't their day of remembrance.");
  return NextResponse.json({ on: await togglePraying({ rememberId: id }, s) });
}
