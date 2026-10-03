import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

export async function getSession() {
  const c = await cookies();
  return verifySession(c.get(SESSION_COOKIE)?.value);
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
