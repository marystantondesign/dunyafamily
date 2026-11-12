import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { listOccasions } from "@/lib/data";
import { filtersFrom, type SP } from "@/lib/filters";
import { findPhotoIds } from "@/lib/photos";

/** "Select all N" in Browse: every photo matching the current filters, not just the ones loaded on the page. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const sp = Object.fromEntries(new URL(req.url).searchParams) as SP;
  const ids = await findPhotoIds(filtersFrom(sp, await listOccasions(), s.pid));
  return NextResponse.json({ ids });
}
