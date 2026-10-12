import { createHash, randomInt } from "crypto";
import { q } from "./db";
import { displayName } from "./names";
import { normalizePhone, sendSms, siteUrl, smsReady } from "./sms";

export const TIMES = { morning: "07:00", midday: "12:00", evening: "18:00", bed: "21:00" } as const;
export const FREQUENCIES = ["daily", "fewweek", "new"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type Include = { prayers: boolean; birthdays: boolean; anniversaries: boolean; remembrance: boolean; answered: boolean };
export type ReminderSettings = {
  enabled: boolean; phone: string | null; verified: boolean; sendTime: string; timeZone: string; frequency: Frequency; include: Include;
};

type Row = {
  person_id: number; phone: string | null; phone_verified_at: string | null; enabled: boolean; send_time: string; time_zone: string; frequency: string;
  include_prayers: boolean; include_birthdays: boolean; include_anniversaries: boolean; include_remembrance: boolean; include_answered: boolean;
  last_sent_at: string | null;
};

const CODE_MINUTES = 10, CODE_TRIES = 5, RESEND_SECONDS = 60;
// A late schedule run still sends, as long as it's within three hours of the person's time.
const LATE_MINUTES = 180;
const SHOWN = 4;

const toSettings = (r: Row | undefined): ReminderSettings => ({
  enabled: r?.enabled ?? false,
  phone: r?.phone ?? null,
  verified: !!r?.phone_verified_at,
  sendTime: r?.send_time ?? TIMES.morning,
  timeZone: r?.time_zone ?? "America/New_York",
  frequency: (FREQUENCIES as readonly string[]).includes(r?.frequency ?? "") ? (r!.frequency as Frequency) : "daily",
  include: {
    prayers: r?.include_prayers ?? true, birthdays: r?.include_birthdays ?? true, anniversaries: r?.include_anniversaries ?? true,
    remembrance: r?.include_remembrance ?? true, answered: r?.include_answered ?? false,
  },
});

export async function getSettings(personId: number) {
  const [r] = await q<Row>(`select * from reminder_settings where person_id = $1`, [personId]);
  return toSettings(r);
}

const validZone = (tz: string) => { try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; } };

export async function saveSettings(personId: number, input: Partial<ReminderSettings>): Promise<string | null> {
  const time = input.sendTime ?? TIMES.morning;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "Pick a time like 7:00 AM.";
  const tz = input.timeZone && validZone(input.timeZone) ? input.timeZone : "America/New_York";
  const freq = (FREQUENCIES as readonly string[]).includes(input.frequency ?? "") ? input.frequency! : "daily";
  const inc = { ...toSettings(undefined).include, ...input.include };
  await q(
    `insert into reminder_settings (person_id, enabled, send_time, time_zone, frequency, include_prayers, include_birthdays, include_anniversaries, include_remembrance, include_answered, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     on conflict (person_id) do update set enabled = $2, send_time = $3, time_zone = $4, frequency = $5, include_prayers = $6, include_birthdays = $7,
       include_anniversaries = $8, include_remembrance = $9, include_answered = $10, updated_at = now()`,
    [personId, !!input.enabled, time, tz, freq, !!inc.prayers, !!inc.birthdays, !!inc.anniversaries, !!inc.remembrance, !!inc.answered]);
  return null;
}

const hashCode = (phone: string, code: string) => createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${phone}:${code}`).digest("hex");

/** Text a 6-digit code to confirm a phone number. Once a minute at most. */
export async function sendCode(personId: number, raw: string): Promise<string | null> {
  const phone = normalizePhone(raw);
  if (!phone) return "That doesn't look like a phone number. Try (212) 555-0143.";
  if (!smsReady() && process.env.SMS_DRY_RUN !== "1") return "Texting isn't set up yet. Mary is working on it.";
  const [recent] = await q(`select 1 from verification_codes where person_id = $1 and created_at > now() - interval '${RESEND_SECONDS} seconds'`, [personId]);
  if (recent) return "Wait a minute before asking for a new code.";
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await q(`insert into verification_codes (person_id, phone, code_hash, expires_at) values ($1, $2, $3, now() + interval '${CODE_MINUTES} minutes')`, [personId, phone, hashCode(phone, code)]);
  // A new number has to be confirmed before anything is sent to it.
  await q(`insert into reminder_settings (person_id, phone) values ($1, $2)
           on conflict (person_id) do update set phone = $2, phone_verified_at = case when reminder_settings.phone = $2 then reminder_settings.phone_verified_at else null end, updated_at = now()`,
    [personId, phone]);
  const body = `Your Dunya Family code is ${code}. It expires in ${CODE_MINUTES} minutes.`;
  // The log never shows the code itself.
  const sent = await deliver(personId, phone, body, "code", body.replace(code, "######"));
  return sent ? null : "The code didn't send. Check the number and try again.";
}

export async function verifyCode(personId: number, code: string): Promise<string | null> {
  const [s] = await q<{ phone: string | null }>(`select phone from reminder_settings where person_id = $1`, [personId]);
  if (!s?.phone) return "Send a code first.";
  const [c] = await q<{ id: number; code_hash: string; expires_at: string; attempts: number; expired: boolean }>(
    `select id, code_hash, expires_at, attempts, expires_at < now() as expired from verification_codes
      where person_id = $1 and phone = $2 and used_at is null order by created_at desc limit 1`, [personId, s.phone]);
  if (!c) return "Send a code first.";
  if (c.expired) return "That code expired. Send a new code.";
  if (c.attempts >= CODE_TRIES) return "Too many tries. Send a new code.";
  if (hashCode(s.phone, code.replace(/\D/g, "")) !== c.code_hash) {
    await q(`update verification_codes set attempts = attempts + 1 where id = $1`, [c.id]);
    return c.attempts + 1 >= CODE_TRIES ? "Too many tries. Send a new code." : "That code doesn't match. Check the text and try again.";
  }
  await q(`update verification_codes set used_at = now() where id = $1`, [c.id]);
  await q(`update reminder_settings set phone_verified_at = now(), updated_at = now() where person_id = $1`, [personId]);
  return null;
}

/** Send a text, trying once more if it fails, and log every try. In dry-run mode (testing only) it's logged but not sent. */
async function deliver(personId: number | null, phone: string, body: string, kind: string, logBody = body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    // Dry run is for testing only: the text goes to the server log instead of a phone.
    if (process.env.SMS_DRY_RUN === "1") console.log(`[dry run] text to ${phone}:\n${body}`);
    const r = process.env.SMS_DRY_RUN === "1" ? { ok: true, id: "dry-run" } : await sendSms(phone, body);
    await q(`insert into reminder_sends (person_id, phone, kind, body, status, provider_id, error) values ($1, $2, $3, $4, $5, $6, $7)`,
      [personId, phone, kind, logBody, r.ok ? (process.env.SMS_DRY_RUN === "1" ? "dry run" : "sent") : "failed", r.id ?? null, r.ok ? null : (r as { error?: string }).error ?? null]);
    if (r.ok) return true;
  }
  return false;
}

/** The person's own clock: date, minutes past midnight, weekday, and hour. */
function localNow(tz: string, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: validZone(tz) ? tz : "America/New_York", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short", hourCycle: "h23",
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`, month: Number(parts.month), day: Number(parts.day),
    minutes: Number(parts.hour) * 60 + Number(parts.minute), hour: Number(parts.hour), weekday: parts.weekday as string,
  };
}

/** "Uncle Ray is having dental surgery on Thursday." becomes something short enough for one line. */
function shorten(text: string, max = 48) {
  const t = text.replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 20)).replace(/[,;:]$/, "")}...`;
}

/** The text for one person, or null when there's nothing to say. */
export async function composeMessage(personId: number, s: ReminderSettings, now: Date, lastSentAt: string | null): Promise<{ body: string; isNew: boolean } | null> {
  const local = localNow(s.timeZone, now);
  const [me] = await q<{ name: string }>(`select name from people where id = $1 and deleted_at is null`, [personId]);
  if (!me) return null;
  const since = lastSentAt ?? new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  const prayers = s.include.prayers ? await q<{ about: string; for_name: string | null; fp: string | null; added: string }>(
    `select r.about, r.for_name, fp.name as fp, pp.created_at as added from prayer_requests r
       join prayer_praying pp on pp.prayer_request_id = r.id and pp.person_id = $1
       left join people fp on fp.id = r.for_person_id and fp.deleted_at is null
      where r.deleted_at is null and r.answered_at is null order by r.created_at desc`, [personId]) : [];
  const answered = s.include.answered ? await q<{ about: string; for_name: string | null; fp: string | null }>(
    `select r.about, r.for_name, fp.name as fp from prayer_requests r
       join prayer_praying pp on pp.prayer_request_id = r.id and pp.person_id = $1
       left join people fp on fp.id = r.for_person_id and fp.deleted_at is null
      where r.deleted_at is null and r.answered_at > $2 order by r.answered_at desc`, [personId, since]) : [];
  const birthdays = s.include.birthdays ? await q<{ name: string }>(
    `select pe.name from birthdays b join people pe on pe.id = b.person_id and pe.deleted_at is null
      where b.deleted_at is null and not pe.in_memory and b.month = $1 and b.day = $2 order by pe.name`, [local.month, local.day]) : [];
  const dates = s.include.anniversaries || s.include.remembrance ? await q<{ name: string; kind: string }>(
    `select pe.name, d.kind from person_dates d join people pe on pe.id = d.person_id and pe.deleted_at is null
      where d.deleted_at is null and d.month = $1 and d.day = $2 and d.kind in ('anniversary', 'remembrance') order by pe.name`, [local.month, local.day]) : [];

  const line = (r: { about: string; for_name: string | null; fp: string | null }) => {
    const who = r.fp ? displayName(r.fp) : r.for_name;
    // "Uncle Ray is having dental surgery" already says who it's for.
    const named = who && r.about.trim().toLowerCase().startsWith(who.toLowerCase());
    return `• ${who && !named ? `${who}: ` : ""}${shorten(r.about)}`;
  };
  const familyLines = [
    ...birthdays.map((b) => `Today is ${displayName(b.name)}'s birthday 🎂`),
    ...dates.filter((d) => d.kind === "anniversary" && s.include.anniversaries).map((d) => `Today is ${displayName(d.name)}'s anniversary 💍`),
    ...dates.filter((d) => d.kind === "remembrance" && s.include.remembrance).map((d) => `Today we remember ${displayName(d.name)} 🕊️`),
  ];
  const answeredLines = answered.map((r) => `Answered: ${line(r).slice(2)} 🙌`);
  if (!prayers.length && !familyLines.length && !answeredLines.length) return null;

  const greeting = local.hour < 12 ? "Good morning" : local.hour < 17 ? "Good afternoon" : "Good evening";
  const name = displayName(me.name);
  const parts: string[] = [];
  if (prayers.length) {
    parts.push(`${greeting}, ${name} 🙏 You're praying for:`);
    parts.push([...prayers.slice(0, SHOWN).map(line), ...(prayers.length > SHOWN ? [`+${prayers.length - SHOWN} more`] : [])].join("\n"));
  } else parts.push(`${greeting}, ${name} 🙏`);
  if (answeredLines.length) parts.push(answeredLines.join("\n"));
  if (familyLines.length) parts.push(familyLines.join("\n"));
  parts.push(`${siteUrl()}/prayer?tab=mine`);
  parts.push("Reply STOP to stop.");
  const isNew = prayers.some((p) => p.added > since) || familyLines.length > 0 || answeredLines.length > 0;
  return { body: parts.join("\n\n"), isNew };
}

/**
 * Run by the schedule every 15 minutes: text everyone whose time has come today, in their own time zone,
 * at most once a day. Returns what happened, for the log.
 */
export async function runReminders(now = new Date()) {
  const rows = await q<Row>(`select * from reminder_settings where enabled and phone is not null and phone_verified_at is not null`);
  const out = { checked: rows.length, sent: 0, skipped: 0, failed: 0 };
  for (const r of rows) {
    const s = toSettings(r);
    const local = localNow(s.timeZone, now);
    const [h, m] = s.sendTime.split(":").map(Number);
    const due = local.minutes >= h * 60 + m && local.minutes < h * 60 + m + LATE_MINUTES;
    const sentToday = r.last_sent_at && localNow(s.timeZone, new Date(r.last_sent_at)).date === local.date;
    if (!due || sentToday) continue;
    if (s.frequency === "fewweek" && !["Mon", "Wed", "Fri"].includes(local.weekday)) continue;
    const msg = await composeMessage(r.person_id, s, now, r.last_sent_at);
    if (!msg || (s.frequency === "new" && !msg.isNew)) { out.skipped++; continue; }
    // Claim today's text first, so two runs at once can never both send.
    const claimed = await q(`update reminder_settings set last_sent_at = $2 where person_id = $1 and last_sent_at is not distinct from $3 returning 1`,
      [r.person_id, now.toISOString(), r.last_sent_at]);
    if (!claimed.length) continue;
    if (await deliver(r.person_id, r.phone!, msg.body, "reminder")) out.sent++; else out.failed++;
  }
  return out;
}

/** Replies to texts: STOP turns reminders off on the site too, START turns them back on. */
export async function handleReply(phone: string, text: string): Promise<string | undefined> {
  const word = text.trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "REVOKE", "OPTOUT"].includes(word)) {
    await q(`update reminder_settings set enabled = false, updated_at = now() where phone = $1`, [phone]);
    await q(`insert into reminder_sends (phone, kind, body, status) values ($1, 'reply', $2, 'stopped')`, [phone, text.slice(0, 200)]);
    return undefined; // Twilio sends its own STOP confirmation.
  }
  if (["START", "UNSTOP", "YES"].includes(word)) {
    await q(`update reminder_settings set enabled = true, updated_at = now() where phone = $1 and phone_verified_at is not null`, [phone]);
    await q(`insert into reminder_sends (phone, kind, body, status) values ($1, 'reply', $2, 'started')`, [phone, text.slice(0, 200)]);
    return undefined;
  }
  if (["HELP", "INFO"].includes(word)) return `Dunya Family prayer reminders. Change them at ${siteUrl()}/you/reminders. Reply STOP to stop.`;
  return undefined;
}
