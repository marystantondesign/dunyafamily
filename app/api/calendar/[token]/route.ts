import { timingSafeEqual } from "crypto";
import { birthdays } from "@/lib/data";
import { q } from "@/lib/db";
import { importantDates } from "@/lib/people";
import { inUpcoming } from "@/lib/inMemory";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

function tokenOk(given: string) {
  const expected = process.env.CALENDAR_TOKEN ?? "";
  const a = Buffer.from(given), b = Buffer.from(expected);
  return expected.length >= 16 && a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Subscription feed for Google, Apple, and Outlook calendars.
 * Holds names and dates only. Addresses and notes stay on the password-protected site.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/, "");
  if (!tokenOk(token)) return new Response("Not found", { status: 404 });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dunya Family//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Dunya Family", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"];

  // Nothing forward-looking for someone in memory; their days of remembrance still come through.
  for (const b of (await birthdays()).filter(inUpcoming)) {
    const start = new Date(2020, b.month - 1, b.day);
    const end = new Date(2020, b.month - 1, b.day + 1);
    lines.push("BEGIN:VEVENT", `UID:birthday-${b.id}@dunyafamily`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`, "RRULE:FREQ=YEARLY", `SUMMARY:${esc(`${b.name}'s birthday`)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }

  // Anniversaries, remembrances, and other important dates repeat every year. Names and dates only.
  for (const d of (await importantDates()).filter((d) => (d.kind === "remembrance" && !d.is_coparent) || inUpcoming(d))) {
    const start = new Date(2020, d.month - 1, d.day);
    const end = new Date(2020, d.month - 1, d.day + 1);
    const summary = d.kind === "anniversary" ? `${d.name}'s anniversary`
      : d.kind === "remembrance" ? (d.label || `Remembering ${d.name}`)
      : d.label.toLowerCase().includes(d.name.toLowerCase()) ? d.label : `${d.label}, ${d.name}`;
    lines.push("BEGIN:VEVENT", `UID:date-${d.id}@dunyafamily`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`, "RRULE:FREQ=YEARLY", `SUMMARY:${esc(summary)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }

  const gatherings = await q<{ id: number; title: string; date: string; end_date: string | null; time_note: string | null }>(
    `select id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(end_date, 'YYYY-MM-DD') as end_date, time_note from gatherings
      where deleted_at is null and coalesce(end_date, date) >= current_date - interval '60 days'`,
  );
  for (const g of gatherings) {
    // All-day events: the end is the day after the last day, so a several-day gathering covers every day.
    const [y, m, d] = g.date.split("-").map(Number);
    const [ey, em, ed] = (g.end_date ?? g.date).split("-").map(Number);
    lines.push("BEGIN:VEVENT", `UID:gathering-${g.id}@dunyafamily`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(new Date(y, m - 1, d))}`, `DTEND;VALUE=DATE:${ymd(new Date(ey, em - 1, ed + 1))}`, `SUMMARY:${esc(g.title)}`, ...(g.time_note ? [`DESCRIPTION:${esc(g.time_note)}`] : []), "END:VEVENT");
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=3600" },
  });
}
