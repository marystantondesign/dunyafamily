import { NextResponse } from "next/server";
import { badRequest, familyPassword, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { checkPassword, hashPassword } from "@/lib/password";

/** Change the family password. Every family device is signed out; the admin password and session stay as they are. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return NextResponse.json({ error: "Only Mary can change the family password." }, { status: 403 });
  const { password, confirm } = (await req.json().catch(() => ({}))) as { password?: string; confirm?: string };
  const pw = (password ?? "").trim();
  if (pw.length < 6) return badRequest("Use at least 6 characters.");
  if (pw !== (confirm ?? "").trim()) return badRequest("The two passwords don't match.");
  if (checkPassword(pw, process.env.ADMIN_PASSWORD_HASH)) return badRequest("Pick something different from your admin password.");
  const { version } = await familyPassword();
  const save = (key: string, value: string) =>
    q(`insert into settings (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`, [key, value]);
  await save("family_password_hash", hashPassword(pw));
  await save("family_password_version", String(version + 1));
  return NextResponse.json({ ok: true });
}
