import { SignJWT, jwtVerify } from "jose";

export type Role = "family" | "admin";
/** pid links this device to a person in the family ("Which one is you?"). Older sessions may not have one yet. */
export type Session = { role: Role; did: string; name: string; pid?: number };

export const SESSION_COOKIE = "df_session";
export const DEVICE_COOKIE = "df_device";
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "");

export async function signSession(s: Session) {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const { role, did, name, pid } = payload as Record<string, unknown>;
    if ((role !== "family" && role !== "admin") || typeof did !== "string" || typeof name !== "string") return null;
    return { role, did, name, ...(typeof pid === "number" ? { pid } : {}) };
  } catch {
    return null;
  }
}
