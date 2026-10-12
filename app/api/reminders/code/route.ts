import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { sendCode } from "@/lib/reminders";

/** Text a 6-digit code to confirm a phone number. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Choose who you are first, from You.");
  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  const err = await sendCode(s.pid, phone ?? "");
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}
