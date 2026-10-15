import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cache } from "react";
import { q } from "./db";
import { checkPassword } from "./password";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

/**
 * The family password can be changed from the site (Admin, Family password). It's saved in settings, with a version
 * number that goes up on every change. Family sessions remember the version they came in with, so changing the
 * password signs out every family device. The admin password stays in the environment and is never affected.
 */
export const familyPassword = cache(async () => {
  const rows = await q<{ key: string; value: string | null }>(
    `select key, value from settings where key in ('family_password_hash', 'family_password_version')`).catch(() => []);
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  return { hash: get("family_password_hash") ?? process.env.FAMILY_PASSWORD_HASH, version: Number(get("family_password_version")) || 0 };
});

export async function roleForPassword(pw: string) {
  if (checkPassword(pw, process.env.ADMIN_PASSWORD_HASH)) return "admin" as const;
  if (checkPassword(pw, (await familyPassword()).hash)) return "family" as const;
  return null;
}

/**
 * The session, plus why it no longer counts: a family session from before the last password change ("password"),
 * or one for someone who can't sign in, or from before people picked who they are ("who").
 */
export const sessionState = cache(async (): Promise<{ session: Session | null; stale: false | "password" | "who" }> => {
  const c = await cookies();
  const s = await verifySession(c.get(SESSION_COOKIE)?.value);
  if (s?.role === "family" && (s.v ?? 0) < (await familyPassword()).version) return { session: null, stale: "password" };
  if (s?.role === "family") {
    // Imported here, not at the top: lib/signin reads the family tree, which reads this file.
    const { canSignIn } = await import("./signin");
    if (!(await canSignIn(s.pid))) return { session: null, stale: "who" };
  }
  return { session: s, stale: false };
});

export async function getSession() {
  return (await sessionState()).session;
}

/** Admin can remove anything. Everyone else can remove only what their device added. */
export function canRemove(s: Session | null, createdByDevice: string | null | undefined) {
  if (!s) return false;
  return s.role === "admin" || (!!createdByDevice && s.did === createdByDevice);
}

export const isAdmin = (s: Session | null) => s?.role === "admin";

export const unauthorized = () => NextResponse.json({ error: "Enter the family password first." }, { status: 401 });
export const forbidden = () =>
  NextResponse.json({ error: "Only the person who added this, or Mary, can change it." }, { status: 403 });
export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
