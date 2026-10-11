import { headers } from "next/headers";
import { AddBirthday, AddGathering } from "@/components/CalendarForms";
import { RemoveButton } from "@/components/RemoveButton";
import { canRemove, getSession } from "@/lib/auth";
import { birthdays, listPeople, upcomingGatherings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const s = await getSession();
  const [bdays, gatherings, people, h] = await Promise.all([birthdays(), upcomingGatherings(), listPeople(), headers()]);
  const host = h.get("host");
  const feed = process.env.CALENDAR_TOKEN ? `webcal://${host}/api/calendar/${process.env.CALENDAR_TOKEN}.ics` : null;

  const byMonth = Array.from({ length: 12 }, (_, m) => bdays.filter((b) => b.month === m + 1).sort((a, b) => a.day - b.day));

  return (
    <>
      <div className="page-head"><h1 className="display">Birthdays &amp; gatherings</h1><p>Celebrating our people and the moments that bring us together.</p></div>

      {feed && (
        <div id="subscribe" className="card" style={{ marginTop: 24 }}>
          <h2 className="section-title" style={{ marginBottom: 6 }}>Put these on your calendar</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Every birthday and gathering shows up in your own calendar and stays updated as the family adds more.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a className="btn btn-primary" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`} target="_blank" rel="noreferrer">Add to Google Calendar</a>
            <a className="btn" href={feed}>Add to Apple Calendar</a>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>Using Outlook or something else? Subscribe by URL with {feed.replace("webcal://", "https://")}</p>
        </div>
      )}

      <section>
        <h2 className="section-title">Coming up</h2>
        {gatherings.length ? (
          <ul className="rows">
            {gatherings.map((g) => (
              <li key={g.id} style={{ flexDirection: "column", gap: 2 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong style={{ fontWeight: 600 }}>{g.title}</strong>
                  <span className="date">
                    {new Date(`${g.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {g.time_note && `, ${g.time_note}`}
                  </span>
                </span>
                {g.location && <span className="small">{g.location}</span>}
                {g.notes && <span className="small muted">{g.notes}</span>}
                <span className="small muted">
                  Added by {g.created_by_name ?? "someone"}
                  {canRemove(s, g.created_by_device) && <> · <RemoveButton url={`/api/gatherings/${g.id}`} confirmText={`Remove ${g.title}?`} /></>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing planned yet.</p>
        )}
        <AddGathering />
      </section>

      <section>
        <h2 className="section-title">Birthdays</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "8px 32px" }}>
          {byMonth.map((list, m) =>
            list.length ? (
              <div key={m}>
                <h3 className="small muted" style={{ margin: "12px 0 4px" }}>{new Date(2000, m, 1).toLocaleString("en-US", { month: "long" })}</h3>
                <ul className="rows">
                  {list.map((b) => (
                    <li key={b.id}>
                      <span>{b.name}</span>
                      <span className="date">
                        {b.day}
                        {canRemove(s, b.created_by_device) && <> · <RemoveButton url={`/api/birthdays/${b.id}`} confirmText={`Remove ${b.name}'s birthday?`} /></>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
        {!bdays.length && <p className="muted">No birthdays saved yet.</p>}
        <AddBirthday people={people.filter((p) => !bdays.some((b) => b.person_id === p.id)).map(({ id, name, aliases }) => ({ id, name, aliases }))} />
      </section>
    </>
  );
}
