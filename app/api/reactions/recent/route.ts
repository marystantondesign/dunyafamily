import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { recentEmoji } from "@/lib/comments";

/** The emoji the family has used most recently, for the top of the reaction picker. */
export async function GET() {
  if (!(await getSession())) return unauthorized();
  return NextResponse.json({ emoji: await recentEmoji() });
}
