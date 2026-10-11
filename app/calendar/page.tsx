import Link from "next/link";
import { headers } from "next/headers";
import { AddBirthday, AddGathering } from "@/components/CalendarForms";
import { Icon } from "@/components/Icon";
import { MonthCalendar, type CalItem } from "@/components/MonthCalendar";
import { birthdays, calendarGatherings, listPeople } from "@/lib/data";
import { importantDates, shortMonthDay } from "@/lib/people";

export const dynamic = "force-dynamic";

const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const [bdays, dates, gatherings, people, h] = await Promise.all([birthdays(), importantDates(), calendarGatherings(), listPeople(), headers()]);
  const host = h.get("host");
  const feed = process.env.CALENDAR_TOKEN ? `webcal://${host}/api/calendar/${process.env.CALENDAR_TOKEN}.ics` : null;
  const avatar = new Map(people.map((p) => [p.id, p.avatar_url]));

  // Birthdays of family in memory, and days of remembrance, are quiet: no party cards, just a line.
  const upcoming = bdays.filter((b) => !b.in_memory).slice(0, 3);
  const quiet = [
    ...bdays.filter((b) => b.in_memory && b.inDays <= 30).map((b) => ({ key: `b${b.id}`, text: `Remembering ${b.name} on their birthday`, inDays: b.inDays, when: shortMonthDay(b.month, b.day), href: `/people/${b.person_id}` })),
    ...dates.filter((d) => d.kind === "remembrance" && d.inDays <= 30).map((d) => ({ key: `d${d.id}`, text: d.label || `Remembering ${d.name}`, inDays: d.inDays, when: shortMonthDay(d.month, d.day), href: `/people/${d.person_id}` })),
  ].sort((a, b) => a.inDays - b.inDays);

  const items: CalItem[] = [
    ...bdays.map((b) => ({
      key: `b${b.id}`,
      kind: b.in_memory ? ("remember" as const) : ("birthday" as const),
      title: `${b.name}'s birthday`,
      lines: b.in_memory ? ["A day to remember"] : ["All day", ...(b.year ? [`Turns ${b.next.getFullYear() - b.year}`] : [])],
      month: b.month, day: b.day, href: `/people/${b.person_id}`,
    })),
    ...dates.map((d) => ({
      key: `d${d.id}`,
      kind: d.kind === "anniversary" ? ("anniversary" as const) : d.kind === "remembrance" || d.in_memory ? ("remember" as const) : ("other" as const),
      title: d.kind === "anniversary" ? `${d.name}'s anniversary` : d.kind === "remembrance" ? d.label || `Remembering ${d.name}` : `${d.label}, ${d.name}`,
      lines: d.kind === "anniversary" ? [d.label].filter(Boolean) : d.kind === "remembrance" ? ["A day to remember"] : [],
      month: d.month, day: d.day, href: `/people/${d.person_id}`,
    })),
    ...gatherings.map((g) => ({
      key: `g${g.id}`, kind: "gathering" as const, title: g.title,
      lines: [g.time_note, g.location].filter((x): x is string => !!x),
      date: g.date, href: `/calendar/gatherings/${g.id}`,
    })),
  ];

  const now = new Date();
  const serverToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <>
      <div className="page-head">
        <h1 className="display">Birthdays &amp; gatherings</h1>
        <p className="lede">Celebrating our people and the moments that bring us together.</p>
      </div>

      <section className="bday-section">
        <div className="section-head">
          <h2 className="section-title">Upcoming birthdays</h2>
        </div>
        {upcoming.length ? (
          <div className="bday-cards">
            {upcoming.map((b) => (
              <Link key={b.id} href={`/people/${b.person_id}`} className="bday-card">
                <span className="bday-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {avatar.get(b.person_id) ? <img src={avatar.get(b.person_id)!} alt="" /> : <span aria-hidden="true">{b.name.charAt(0)}</span>}
                </span>
                <span className="bday-text">
                  <strong>{b.name}</strong>
                  <span>{b.inDays === 0 ? "Today" : longDate(b.next)}</span>
                  {b.year && <span>Turns {b.next.getFullYear() - b.year}</span>}
                </span>
                <Icon name="cake" size={22} className="bday-icon" />
              </Link>
            ))}
          </div>
        ) : <p className="muted">No birthdays saved yet. Add one below.</p>}
        {quiet.length > 0 && (
          <ul className="quiet-dates">
            {quiet.map((q) => <li key={q.key}><Icon name="moon" size={16} /><span><Link href={q.href}>{q.text}</Link>, {q.when}</span></li>)}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <MonthCalendar items={items} initialDay={day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined} serverToday={serverToday} />
        {feed && (
          <div id="subscribe" className="subscribe">
            <p className="small muted">Put every birthday, anniversary, and gathering in your own calendar. It stays updated as the family adds more.</p>
            <div className="actions" style={{ marginTop: 10 }}>
              <a className="btn" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`} target="_blank" rel="noreferrer"><Icon name="calendar" size={18} /> Google Calendar</a>
              <a className="btn" href={feed}><Icon name="calendar" size={18} /> Apple Calendar</a>
            </div>
            <p className="hint">Using Outlook or something else? Subscribe by URL with {feed.replace("webcal://", "https://")}</p>
          </div>
        )}
      </section>

      <section className="cal-add">
        <AddBirthday people={people.filter((p) => !bdays.some((b) => b.person_id === p.id)).map(({ id, name, aliases }) => ({ id, name, aliases }))} />
        <AddGathering />
      </section>
    </>
  );
}
