import { NextResponse } from "next/server";
import { getSession, isAdmin, unauthorized } from "@/lib/auth";
import { setPreviewsOn } from "@/lib/sharePreview";

/** Mary's switch: show the photo in shared photo link previews, or the generic card everywhere. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return NextResponse.json({ error: "Only Mary can change this." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { on?: unknown };
  if (typeof body.on !== "boolean") return NextResponse.json({ error: "Unknown change." }, { status: 400 });
  await setPreviewsOn(body.on);
  return NextResponse.json({ ok: true });
}
