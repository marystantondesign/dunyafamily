import { NextResponse, type NextRequest } from "next/server";
import { getSession, isAdmin, unauthorized } from "@/lib/auth";
import { countPhotos, findPhotos } from "@/lib/photos";

const PAGE = 48;

/** The photo picker on Homepage photos: photos of one person (Dunya by default), or every photo. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return NextResponse.json({ error: "Admin only." }, { status: 403 });
  const person = Number(req.nextUrl.searchParams.get("person")) || null;
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset")) || 0);
  const f = person ? { people: [person] } : {};
  const [photos, total] = await Promise.all([findPhotos(f, { order: "newest", limit: PAGE, offset }), countPhotos(f)]);
  return NextResponse.json({ photos: photos.map((p) => ({ id: p.id, url: p.url })), more: offset + PAGE < total });
}
