import { SignJWT, jwtVerify } from "jose";

export type Role = "family" | "admin";
export type Session = { role: Role; did: string; name: string };

export const SESSION_COOKIE = "df_session";
export const DEVICE_COOKIE = "df_device";

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
    const { role, did, name } = payload as Record<string, unknown>;
    if ((role !== "family" && role !== "admin") || typeof did !== "string" || typeof name !== "string") return null;
    return { role, did, name };
  } catch {
    return null;
  }
}
