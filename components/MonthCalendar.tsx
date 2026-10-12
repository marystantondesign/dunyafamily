"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { TagPicker, type Option, type Picked } from "./TagPicker";

export type CalKind = "birthday" | "anniversary" | "gathering" | "remember" | "other";
export type CalItem = {
  key: string; kind: CalKind; title: string; lines: string[]; href: string;
  /** Repeats every year on month/day, or happens once on date (YYYY-MM-DD), through endDate when it runs several days. */
  month?: number; day?: number; date?: string; endDate?: string | null;
};

const ICON: Record<CalKind, IconName> = { birthday: "cake", anniversary: "heart", gathering: "family", remember: "moon", other: "calendar" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (s: string) => parse(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000) + 1;

function itemsOn(items: CalItem[], day: Date) {
  const key = iso(day);
  // Feb 29 birthdays show on Feb 28 in years without a leap day.
  const leapFix = (m: number, d: number) => m === 2 && d === 29 && new Date(day.getFullYear(), 1, 29).getMonth() !== 1;
  return items.filter((it) => it.date ? key >= it.date && key <= (it.endDate ?? it.date)
    : it.month === day.getMonth() + 1 && (it.day === day.getDate() || (leapFix(it.month!, it.day!) && day.getDate() === 28)));
}

type Range = { start: string; end: string } | null;
type Kind = "birthday" | "anniversary" | "gathering" | "remember";
const KINDS: { kind: Kind; icon: string; title: string; every: string; button: string }[] = [
  { kind: "birthday", icon: "🎂", title: "Birthday", every: "Every year", button: "Add birthday" },
  { kind: "anniversary", icon: "💍", title: "Anniversary", every: "Every year", button: "Add anniversary" },
  { kind: "gathering", icon: "🎉", title: "Gathering or event", every: "One time", button: "Add gathering" },
  { kind: "remember", icon: "🕊️", title: "A day to remember", every: "Every year", button: "Add day to remember" },
];

/** Add an event (mockups 51 and 52). Several days can only be a gathering. */
function AddEvent({ range, people, start: startKind, onClose }: { range: { start: string; end: string }; people: Option[]; start?: Kind; onClose: () => void }) {
  const router = useRouter();
  const many = range.start !== range.end;
  const [kind, setKind] = useState<Kind>(many ? "gathering" : startKind ?? "birthday");
  const [who, setWho] = useState<Picked[]>([]);
  const [knowYear, setKnowYear] = useState(false);
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [where, setWhere] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const d = parse(range.start), e = parse(range.end);
  const when = many
    ? `${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })} to ${e.getMonth() === d.getMonth() ? e.getDate() : e.toLocaleDateString("en-US", { month: "long", day: "numeric" })}, ${e.getFullYear()} · ${daysBetween(range.start, range.end)} days`
    : d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const order = many ? KINDS.filter((k) => k.kind === "gathering").concat(KINDS.filter((k) => k.kind !== "gathering")) : KINDS;
  const ready = kind === "gathering" ? !!title.trim() : who.length > 0 && (!knowYear || kind !== "birthday" || /^\d{4}$/.test(year));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError("");
    const month = d.getMonth() + 1, day = d.getDate();
    const [url, body] = kind === "birthday" ? ["/api/birthdays", { person: who[0], month, day, year: knowYear && year ? Number(year) : null }]
      : kind === "gathering" ? ["/api/gatherings", { title, date: range.start, endDate: range.end, location: where }]
      : ["/api/calendar/dates", { kind: kind === "remember" ? "remembrance" : "anniversary", people: who, note, month, day }];
    const res = await fetch(url as string, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again."); setBusy(false); return; }
    router.refresh();
    onClose();
  }

  return (
    <div className="modal-backdrop ae-backdrop" onClick={onClose}>
      <form className="ae" role="dialog" aria-modal="true" aria-labelledby="ae-title" onClick={(ev) => ev.stopPropagation()} onSubmit={save}>
        <div className="sheet-grip phone-only" aria-hidden="true" />
        <div className="ae-head">
          <h2 id="ae-title">Add an event</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" size={22} /></button>
        </div>
        <p className="ae-when">{when}</p>
        <div className="ae-kinds" role="radiogroup" aria-label="What kind of event">
          {order.map((k) => {
            const off = many && k.kind !== "gathering";
            return (
              <button key={k.kind} type="button" role="radio" aria-checked={kind === k.kind} disabled={off}
                className={`ae-kind${kind === k.kind ? " on" : ""}`} onClick={() => { setKind(k.kind); setWho([]); setError(""); }}>
                <span className="ae-kind-icon" aria-hidden="true">{k.icon}</span>
                <span><strong>{k.title}</strong><span>{off ? "One day only" : k.every}</span></span>
              </button>
            );
          })}
        </div>
        {many && <p className="ae-note">Birthdays, anniversaries, and days to remember need a single day.</p>}

        <div className="ae-fields">
          {kind === "birthday" && (
            <>
              <TagPicker label="Whose birthday?" options={people} value={who} onChange={(v) => setWho(v.slice(-1))} placeholder="Start typing a name" />
              <label className="ae-check"><input type="checkbox" checked={knowYear} onChange={(ev) => setKnowYear(ev.target.checked)} /> I know the year they were born</label>
              {knowYear && (
                <div className="field ae-year">
                  <label htmlFor="ae-year">Year they were born</label>
                  <input id="ae-year" inputMode="numeric" maxLength={4} placeholder="1974" value={year} onChange={(ev) => setYear(ev.target.value.replace(/\D/g, ""))} />
                </div>
              )}
            </>
          )}
          {kind === "anniversary" && (
            <TagPicker label="Whose anniversary?" options={people} value={who} onChange={(v) => setWho(v.slice(-2))} placeholder="One or two people" hint="Pick one person, or both of them." />
          )}
          {kind === "gathering" && (
            <>
              <div className="field">
                <label htmlFor="ae-what">What is it?</label>
                <input id="ae-what" value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Family reunion, Thanksgiving, a trip" />
              </div>
              <div className="field">
                <label htmlFor="ae-where">Where? <span className="opt">Optional</span></label>
                <input id="ae-where" value={where} onChange={(ev) => setWhere(ev.target.value)} placeholder="Address or place" />
              </div>
            </>
          )}
          {kind === "remember" && (
            <>
              <TagPicker label="Who or what?" options={people} value={who} onChange={(v) => setWho(v.slice(-1))} placeholder="Start typing a name" />
              <div className="field">
                <label htmlFor="ae-note">Note <span className="opt">Optional</span></label>
                <input id="ae-note" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Remembering Grandpa Sam" />
              </div>
            </>
          )}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="ae-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy || !ready}>{busy ? "Saving" : KINDS.find((k) => k.kind === kind)!.button}</button>
        </div>
      </form>
    </div>
  );
}

/**
 * The month (mockup 50). Click a day to select it (again to unselect), drag or Shift-click for several days, or on a
 * phone tap one day and then another. "Add event" adds to the selection, or today with nothing selected.
 */
export function MonthCalendar({ items, initialDay, serverToday, people, feed }: {
  items: CalItem[]; initialDay?: string; serverToday: string; people: Option[]; feed: string | null;
}) {
  const [today, setToday] = useState(serverToday);
  const [range, setRange] = useState<Range>(initialDay ? { start: initialDay, end: initialDay } : null);
  // The day whose events show in the side panel: the last one clicked.
  const [focus, setFocus] = useState(initialDay ?? serverToday);
  const [month, setMonth] = useState(() => { const d = parse(initialDay ?? serverToday); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [adding, setAdding] = useState<{ start: string; end: string; kind?: Kind } | null>(null);
  const [showUrl, setShowUrl] = useState(false);
  const drag = useRef<{ anchor: string; moved: boolean } | null>(null);
  const anchor = useRef<string | null>(initialDay ?? null);
  const coarse = useRef(false);

  // Use this device's own date once the page is open.
  useEffect(() => {
    coarse.current = window.matchMedia("(pointer: coarse)").matches;
    const t = iso(new Date());
    setToday(t);
    if (!initialDay) { setFocus(t); const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }
    // The Add menu links straight here: /calendar#add-birthday and #add-gathering open the popup on today.
    const kind = window.location.hash === "#add-birthday" ? "birthday" : window.location.hash === "#add-gathering" ? "gathering" : null;
    if (kind) setAdding({ start: t, end: t, kind });
  }, [initialDay]);
  useEffect(() => {
    // A drag ends when the button comes up, wherever it is. The click that follows a drag is ignored.
    const up = () => { const dr = drag.current; if (dr) setTimeout(() => { if (drag.current === dr) drag.current = null; }, 0); };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const cells = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const move = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const span = (a: string, b: string) => (a <= b ? { start: a, end: b } : { start: b, end: a });
  const inRange = (k: string) => !!range && k >= range.start && k <= range.end;

  function choose(k: string, shift: boolean) {
    setFocus(k);
    if (shift && anchor.current) { setRange(span(anchor.current, k)); return; }
    // Phones: a second tap on another day makes a range.
    if (coarse.current && range && range.start === range.end && range.start !== k) { setRange(span(range.start, k)); return; }
    if (range && range.start === k && range.end === k) { setRange(null); anchor.current = null; return; }
    setRange({ start: k, end: k });
    anchor.current = k;
  }

  const count = range ? daysBetween(range.start, range.end) : 0;
  const hint = !range ? "Click a day, or drag across days, then add" : count === 1 ? "1 day selected" : `${count} days selected`;
  const sel = parse(focus);
  const selItems = itemsOn(items, sel);
  const title = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="cal-wrap">
      <div className="cal-main">
        <div className="cal-head">
          <div className="cal-nav">
            <button type="button" className="round-btn" aria-label="Previous month" onClick={() => move(-1)}><Icon name="chevronLeft" size={18} /></button>
            <h2 aria-live="polite">{title}</h2>
            <button type="button" className="round-btn" aria-label="Next month" onClick={() => move(1)}><Icon name="chevronRight" size={18} /></button>
          </div>
          <div className="cal-add">
            <span className="cal-hint" aria-live="polite">{hint}</span>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(range ?? { start: today, end: today })}>
              <Icon name="plus" size={16} stroke={2.2} /> Add event
            </button>
          </div>
        </div>
        <div className="cal-grid" role="grid" aria-label={title} aria-multiselectable="true">
          {WEEKDAYS.map((w) => <div key={w} className="cal-dow" role="columnheader">{w}</div>)}
          {cells.map((d) => {
            const k = iso(d);
            const its = itemsOn(items, d);
            const outside = d.getMonth() !== month.getMonth();
            const label = `${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${its.length ? `, ${its.length} ${its.length === 1 ? "event" : "events"}` : ""}`;
            return (
              <button
                key={k}
                type="button"
                role="gridcell"
                aria-label={label}
                aria-selected={inRange(k)}
                className={`cal-day${outside ? " outside" : ""}${k === today ? " today" : ""}${inRange(k) ? " selected" : ""}`}
                onPointerDown={(ev) => { if (ev.pointerType === "mouse" && !ev.shiftKey) drag.current = { anchor: k, moved: false }; }}
                onPointerEnter={() => {
                  const dr = drag.current;
                  if (!dr || dr.anchor === k) return;
                  dr.moved = true;
                  setRange(span(dr.anchor, k));
                  anchor.current = dr.anchor;
                  setFocus(k);
                }}
                onClick={(ev) => {
                  if (drag.current?.moved) { drag.current = null; return; }
                  drag.current = null;
                  choose(k, ev.shiftKey);
                  if (outside) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
              >
                <span className="num">{d.getDate()}</span>
                <span className="dots" aria-hidden="true">
                  {its.slice(0, 4).map((it) => <span key={it.key} className={`dot dot-${it.kind}`} />)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <aside className="cal-side" id="subscribe">
        <ul className="cal-legend" aria-label="What the dots mean">
          <li><span className="dot dot-birthday" /> Birthday</li>
          <li><span className="dot dot-anniversary" /> Anniversary</li>
          <li><span className="dot dot-gathering" /> Gathering or event</li>
          <li><span className="dot dot-remember" /> A day to remember</li>
        </ul>
        <section className="cal-events" aria-live="polite">
          <h3>{longDate(focus)}</h3>
          {selItems.length ? (
            <ul>
              {selItems.map((it) => (
                <li key={it.key} className={it.kind === "remember" ? "quiet" : undefined}>
                  <Link href={it.href}>
                    <Icon name={ICON[it.kind]} size={22} className="ev-icon" />
                    <span>
                      <strong>{it.title}</strong>
                      {it.lines.map((l) => <span key={l} className="ev-line">{l}</span>)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nothing on this day.</p>}
        </section>
        {feed && (
          <div className="cal-sub">
            <p>Add every date to your own calendar:</p>
            <div className="cal-sub-btns">
              <a className="btn" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed)}`} target="_blank" rel="noreferrer">Google Calendar</a>
              <a className="btn" href={feed}>Apple Calendar</a>
            </div>
            <button type="button" className="text-btn cal-other" aria-expanded={showUrl} onClick={() => setShowUrl(!showUrl)}>Other calendar app</button>
            {showUrl && <p className="hint cal-url">Subscribe by URL with <span>{feed.replace("webcal://", "https://")}</span></p>}
          </div>
        )}
      </aside>

      {adding && <AddEvent range={adding} start={adding.kind} people={people} onClose={() => setAdding(null)} />}
    </div>
  );
}
