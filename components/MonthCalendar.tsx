"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon, type IconName } from "./Icon";

export type CalKind = "birthday" | "anniversary" | "gathering" | "remember" | "other";
export type CalItem = {
  key: string; kind: CalKind; title: string; lines: string[]; href: string;
  /** Repeats every year on month/day, or happens once on date (YYYY-MM-DD). */
  month?: number; day?: number; date?: string;
};

const ICON: Record<CalKind, IconName> = { birthday: "cake", anniversary: "heart", gathering: "family", remember: "moon", other: "calendar" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

function itemsOn(items: CalItem[], day: Date) {
  const key = iso(day);
  // Feb 29 birthdays show on Feb 28 in years without a leap day.
  const leapFix = (m: number, d: number) => m === 2 && d === 29 && new Date(day.getFullYear(), 1, 29).getMonth() !== 1;
  return items.filter((it) => it.date ? it.date === key
    : it.month === day.getMonth() + 1 && (it.day === day.getDate() || (leapFix(it.month!, it.day!) && day.getDate() === 28)));
}

/** Month view with colored dots and the selected day's events beside it (screens 16 and 17). */
export function MonthCalendar({ items, initialDay, serverToday }: { items: CalItem[]; initialDay?: string; serverToday: string }) {
  const [today, setToday] = useState(serverToday);
  const [selected, setSelected] = useState(initialDay ?? serverToday);
  const [month, setMonth] = useState(() => { const d = parse(initialDay ?? serverToday); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // Use this device's own date once the page is open.
  useEffect(() => {
    const t = iso(new Date());
    setToday(t);
    if (!initialDay) { setSelected(t); const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }
  }, [initialDay]);

  const cells = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);

  const move = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const sel = parse(selected);
  const selItems = itemsOn(items, sel);
  const title = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="cal-wrap">
      <div className="cal-main">
        <div className="cal-head">
          <button type="button" className="round-btn" aria-label="Previous month" onClick={() => move(-1)}><Icon name="chevronLeft" size={18} /></button>
          <h2 aria-live="polite">{title}</h2>
          <button type="button" className="round-btn" aria-label="Next month" onClick={() => move(1)}><Icon name="chevronRight" size={18} /></button>
        </div>
        <div className="cal-grid" role="grid" aria-label={title}>
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
                aria-selected={k === selected}
                className={`cal-day${outside ? " outside" : ""}${k === today ? " today" : ""}${k === selected ? " selected" : ""}`}
                onClick={() => { setSelected(k); if (outside) setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}
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

      <aside className="cal-side">
        <ul className="cal-legend" aria-label="What the dots mean">
          <li><span className="dot dot-birthday" /> Birthday</li>
          <li><span className="dot dot-anniversary" /> Anniversary</li>
          <li><span className="dot dot-gathering" /> Gathering or event</li>
          <li><span className="dot dot-remember" /> A day to remember</li>
        </ul>
        <section className="cal-events" aria-live="polite">
          <h3>Events on {sel.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</h3>
          {selItems.length ? (
            <ul>
              {selItems.map((it) => (
                <li key={it.key} className={it.kind === "remember" ? "quiet" : undefined}>
                  <Link href={it.href}>
                    <Icon name={ICON[it.kind]} size={24} className="ev-icon" />
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
      </aside>
    </div>
  );
}
