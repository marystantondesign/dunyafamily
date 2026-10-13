import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { favoriteIds, setFavorite } from "@/lib/favorites";
import type { Session } from "@/lib/session";

const NO_ONE = "Choose who you are first, from your picture at the top.";

// The person always comes from the session, never from the request.
async function who(): Promise<{ s: Session; pid: number } | { error: Response }> {
  const s = await getSession();
  if (!s) return { error: unauthorized() };
  if (!s.pid) return { error: badRequest(NO_ONE) };
  return { s, pid: s.pid };
}

/** The current person's favorites, newest first. */
export async function GET() {
  const w = await who();
  if ("error" in w) return w.error;
  return NextResponse.json({ photoIds: await favoriteIds(w.pid) });
}

async function change(req: Request, on: boolean) {
  const w = await who();
  if ("error" in w) return w.error;
  const { photoId } = (await req.json().catch(() => ({}))) as { photoId?: number };
  if (!Number.isInteger(photoId)) return badRequest("Which photo?");
  const err = await setFavorite(w.pid, photoId!, on);
  return err ? badRequest(err) : NextResponse.json({ ok: true, favorite: on });
}

/** Favorite a photo. */
export const POST = (req: Request) => change(req, true);
/** Unfavorite a photo. */
export const DELETE = (req: Request) => change(req, false);
