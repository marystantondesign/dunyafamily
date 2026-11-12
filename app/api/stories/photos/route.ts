import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { pickerPhotos } from "@/lib/storyAdmin";

/**
 * Photos for the story photo picker (?q= search, ?person= one person's photos): Mary's Add a story, and anyone's
 * Submit a story. Photos someone hid from themselves stay out of their picker.
 */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const u = new URL(req.url);
  const person = Number(u.searchParams.get("person")) || null;
  return NextResponse.json({ photos: await pickerPhotos(u.searchParams.get("q") ?? "", person, s.pid ?? null) });
}
