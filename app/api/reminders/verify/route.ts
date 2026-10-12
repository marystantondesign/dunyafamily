import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { verifyCode } from "@/lib/reminders";

/** Check the code someone typed in. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Choose who you are first, from You.");
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const err = await verifyCode(s.pid, code ?? "");
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}
