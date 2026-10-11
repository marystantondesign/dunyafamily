import { NextResponse } from "next/server";
import { badRequest, getSession, isAdmin, unauthorized } from "@/lib/auth";
import {
  addHomepagePhotos, MAX_SPOTS, orderHomepagePhotos, removeHomepagePhoto, setHomepageCaption, setHomepageSpeed, spotsUsed,
} from "@/lib/homepage";

type Body =
  | { action: "add"; photoIds: number[]; caption?: string }
  | { action: "caption"; photoId: number; caption: string }
  | { action: "remove"; photoId: number }
  | { action: "order"; photoIds: number[] }
  | { action: "speed"; seconds: number };

const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(Number).filter(Number.isInteger))] : []);

/** Homepage photos: admin only. Every change saves right away. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return NextResponse.json({ error: "Only Mary can change the homepage photos." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Body;
  switch (body.action) {
    case "add": {
      const want = ids(body.photoIds);
      if (!want.length) return badRequest("Choose at least one photo.");
      const added = await addHomepagePhotos(want, s, body.caption);
      if (!added && (await spotsUsed()) >= MAX_SPOTS) return badRequest(`All ${MAX_SPOTS} spots are used. Remove one first.`);
      return NextResponse.json({ added });
    }
    case "caption": await setHomepageCaption(Number(body.photoId), body.caption); break;
    case "remove": await removeHomepagePhoto(Number(body.photoId)); break;
    case "order": await orderHomepagePhotos(ids(body.photoIds)); break;
    case "speed": await setHomepageSpeed(Number(body.seconds)); break;
    default: return badRequest("Unknown change.");
  }
  return NextResponse.json({ ok: true });
}
