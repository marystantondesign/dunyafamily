import { NextResponse } from "next/server";
import { forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { importFromNotion } from "@/lib/notion";

export const maxDuration = 300;

/** Mary only: bring new answered pages over from Notion as drafts. */
export async function POST() {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return forbidden();
  try {
    const r = await importFromNotion();
    const plural = (n: number) => `${n} ${n === 1 ? "story" : "stories"}`;
    return NextResponse.json({ ...r, message: r.added ? `Brought over ${plural(r.added)} as drafts.` : "No new stories in Notion." });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The import didn't work. Try again." }, { status: 500 });
  }
}
