import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { addRequest, type PrayerInput } from "@/lib/prayer";

/** Ask for prayer. Anyone in the family can. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = await addRequest((await req.json().catch(() => ({}))) as PrayerInput, s);
  return typeof id === "number" ? NextResponse.json({ id }) : badRequest(id);
}
