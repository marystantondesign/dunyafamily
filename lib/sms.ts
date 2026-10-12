import { createHmac, timingSafeEqual } from "crypto";

/** Texting through Twilio's web API. Nothing here runs until the Twilio settings are filled in. */
const env = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID ?? "",
  token: process.env.TWILIO_AUTH_TOKEN ?? "",
  from: process.env.TWILIO_FROM ?? "",
  service: process.env.TWILIO_MESSAGING_SERVICE_SID ?? "",
});

export const smsReady = () => { const e = env(); return !!(e.sid && e.token && (e.from || e.service)); };

/** The site's own address for links in texts. */
export const siteUrl = (fallback?: string) => (process.env.SITE_URL || fallback || "https://dunyafamily-nine.vercel.app").replace(/\/$/, "");

/** US numbers in any common format become +1XXXXXXXXXX. Anything else needs a leading +. */
export function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  const digits = t.replace(/\D/g, "");
  if (t.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** +12125550143 shows as (212) 555-0143. */
export function formatPhone(e164: string | null) {
  if (!e164) return "";
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export type SendResult = { ok: boolean; id?: string; error?: string };

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const e = env();
  if (!smsReady()) return { ok: false, error: "Texting isn't set up yet." };
  const form = new URLSearchParams({ To: to, Body: body });
  if (e.service) form.set("MessagingServiceSid", e.service); else form.set("From", e.from);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${e.sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${e.sid}:${e.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    return res.ok ? { ok: true, id: data.sid } : { ok: false, error: `${data.code ?? res.status}: ${data.message ?? "Twilio refused the text."}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Check that a request really came from Twilio: its signature is an HMAC of the URL and the posted fields. */
export function fromTwilio(url: string, params: Record<string, string>, signature: string | null) {
  const { token } = env();
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A reply Twilio sends back to the person (TwiML). */
export function twiml(message?: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${esc(message)}</Message>` : ""}</Response>`;
}
