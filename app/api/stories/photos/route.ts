import { NextResponse } from "next/server";
import { pickerPhotos } from "@/lib/storyAdmin";
import { adminOr404 } from "@/lib/storySave";

/** Mary only: photos for the story photo picker (?q= search, ?person= one person's photos). */
export async function GET(req: Request) {
  const no = await adminOr404();
  if (no) return no;
  const u = new URL(req.url);
  const person = Number(u.searchParams.get("person")) || null;
  return NextResponse.json({ photos: await pickerPhotos(u.searchParams.get("q") ?? "", person) });
}
