import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { sendRemovals, type RemovalAnswer } from "@/lib/removals";

/** Send removal requests for photos of yourself (from your own profile). */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const { answers } = (await req.json().catch(() => ({}))) as { answers?: RemovalAnswer[] };
  const out = await sendRemovals(s, Array.isArray(answers) ? answers : []);
  return typeof out === "number" ? NextResponse.json({ sent: out }) : badRequest(out);
}
