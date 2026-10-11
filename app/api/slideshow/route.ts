import { NextResponse, type NextRequest } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { signGet } from "@/lib/r2";

/**
 * Fresh links for the next few slideshow photos (?ids=1,2,3). Links last an hour, so a long slideshow
 * asks again as it goes instead of holding links that have expired.
 */
export async function GET(req: NextRequest) {
  if (!(await getSession())) return unauthorized();
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").map(Number).filter(Number.isInteger).slice(0, 12);
  if (!ids.length) return badRequest("No photos asked for.");
  const rows = await q<{ id: number; original_key: string }>(`select id, original_key from photos where id = any($1::int[]) and deleted_at is null`, [ids]);
  const urls = Object.fromEntries(await Promise.all(rows.map(async (r) => [r.id, await signGet(r.original_key)] as const)));
  return NextResponse.json({ urls, at: Date.now() });
}
