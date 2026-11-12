import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { signPut } from "@/lib/r2";

/** Upload spots for a submitted story's photos: private storage, never the family archive. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Pick yourself first.");
  const { count } = (await req.json().catch(() => ({}))) as { count?: number };
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 10) return badRequest("Add up to 10 photos.");
  return NextResponse.json(await Promise.all(Array.from({ length: n }, async () => {
    const id = crypto.randomUUID();
    const key = `submissions/${id}.jpg`, thumbKey = `submissions/${id}-thumb.jpg`;
    return { key, thumbKey, url: await signPut(key, "image/jpeg"), thumbUrl: await signPut(thumbKey, "image/jpeg") };
  })));
}
