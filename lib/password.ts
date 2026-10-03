import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Format is salt:hash in hex, so it is safe to paste into .env files (no $ characters).
export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function checkPassword(pw: string, stored: string | undefined) {
  if (!stored || !pw) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(pw, salt, 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
