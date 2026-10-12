import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { saveSettings, type ReminderSettings } from "@/lib/reminders";

/** Save text reminder settings for the person on this device. */
export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Choose who you are first, from You.");
  const err = await saveSettings(s.pid, (await req.json().catch(() => ({}))) as Partial<ReminderSettings>);
  return err ? badRequest(err) : NextResponse.json({ ok: true });
}
