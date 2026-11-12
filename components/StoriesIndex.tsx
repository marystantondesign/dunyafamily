"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FilterPerson, StoryCard } from "@/lib/stories";
import { Halo } from "./Halo";
import { Icon } from "./Icon";
import { BookSketch } from "./Sketches";

const THEMES = [
  ["growing-up", "Growing up"], ["family", "Family"], ["school-and-work", "School and work"],
  ["love-and-marriage", "Love and marriage"], ["raising-kids", "Raising kids"], ["favorites-and-advice", "Favorites and advice"],
] as const;
const SHOW = 8;
type Item = { id: number; name: string };
type Key = "people" | "occasions" | "decades";

const nums = (v: string) => v.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);

/** A face in the memorial treatment when they're in memory. */
export function StoryFace({ p, size }: { p: { name: string; avatarUrl: string | null; inMemory: boolean }; size: number }) {
  return (
    <Halo on={p.inMemory} name={p.name}>
      <span className="story-face" style={{ width: size, height: size }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
      </span>
    </Halo>
  );
}

/** The photo on a card, or a warm block with the book sketch when a story has none. */
function CardPhoto({ url, className }: { url: string | null; className: string }) {
  return (
    <span className={`${className}${url ? "" : " empty"}`} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" loading="lazy" /> : <BookSketch height={44} />}
    </span>
  );
}

/**
 * In Her Words, the index. Theme chips (one at a time), and Filters for the people, occasions, and decades a story
 * mentions: within a row any match counts, across rows (and the theme) all must match. Everything is in the URL.
 */
export function StoriesIndex({ stories, featuredId, people, occasions, decades, initial, want: want0, canWant }: {
  stories: StoryCard[]; featuredId: number | null; people: FilterPerson[]; occasions: Item[]; decades: number[];
  initial: { theme: string | null; people: string; occasions: string; decades: string }; want: boolean; canWant: boolean;
}) {
  const bySlug = useMemo(() => new Map(people.map((p) => [p.slug, p.id])), [people]);
  const [theme, setTheme] = useState<string | null>(THEMES.some(([v]) => v === initial.theme) ? initial.theme : null);
  const [sel, setSel] = useState<Record<Key, number[]>>({
    people: initial.people.split(",").map((x) => bySlug.get(x.trim().toLowerCase()) ?? 0).filter(Boolean),
    occasions: nums(initial.occasions).filter((id) => occasions.some((o) => o.id === id)),
    decades: nums(initial.decades).filter((d) => decades.includes(d)),
  });
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Key | null>(null);
  const [allPeople, setAllPeople] = useState(false);
  const [want, setWant] = useState(want0);
  // Once someone is on the list, the bar is gone for that profile on later visits; during this visit it can be undone.
  const showBook = !want0;
  const wrap = useRef<HTMLDivElement>(null);

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (theme) u.set("theme", theme);
    if (sel.people.length) u.set("people", sel.people.map((id) => people.find((p) => p.id === id)?.slug).filter(Boolean).join(","));
    if (sel.occasions.length) u.set("occasions", sel.occasions.join(","));
    if (sel.decades.length) u.set("decades", sel.decades.join(","));
    return u.toString();
  }, [theme, sel, people]);
  // Keep the URL in step with the filters, only when they change (never while leaving for a story).
  const lastQs = useRef(qs);
  useEffect(() => {
    if (qs === lastQs.current) return;
    lastQs.current = qs;
    window.history.replaceState(null, "", `/stories${qs ? `?${qs}` : ""}`);
  }, [qs]);

  // Desktop: the dropdown closes on a click outside it or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (window.innerWidth > 760 && !wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  const any = (picked: number[], has: number[]) => !picked.length || picked.some((x) => has.includes(x));
  const list = stories.filter((s) => (!theme || s.theme === theme) && any(sel.people, s.people) && any(sel.occasions, s.occasions) && any(sel.decades, s.decades));
  const nPicked = sel.people.length + sel.occasions.length + sel.decades.length;
  const filtered = nPicked > 0 || !!theme;
  const featured = !filtered ? list.find((s) => s.id === featuredId) ?? null : null;
  const rest = featured ? list.filter((s) => s.id !== featured.id) : list;

  const names: Record<Key, (id: number) => string> = {
    people: (id) => people.find((p) => p.id === id)?.first ?? "",
    occasions: (id) => occasions.find((o) => o.id === id)?.name ?? "",
    decades: (d) => `${d}s`,
  };
  const labels = (["people", "occasions", "decades"] as Key[]).flatMap((k) => sel[k].map(names[k]));
  const barLabel = labels.length ? `${labels[0]}${labels.length > 1 ? ` +${labels.length - 1} more` : ""}` : "Filters";
  const toggle = (k: Key, id: number) => setSel((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((v) => v !== id) : [...x[k], id] }));
  const clear = () => setSel({ people: [], occasions: [], decades: [] });
  const from = qs ? `?from=${encodeURIComponent(qs)}` : "";

  async function toggleWant() {
    const next = !want;
    setWant(next);
    const res = await fetch("/api/stories/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ want: next }) });
    if (!res.ok) setWant(!next);
  }

  const matched = (s: StoryCard) => {
    const m = sel.people.filter((id) => s.people.includes(id)).map((id) => people.find((p) => p.id === id)!).filter(Boolean);
    if (!m.length) return null;
    const text = m.length <= 2 ? m.map((p) => p.first).join(", ") : `${m[0].first}, ${m[1].first} +${m.length - 2}`;
    return (
      <span className="sc-with">
        <span className="sc-faces">{m.slice(0, 3).map((p) => <StoryFace key={p.id} p={p} size={22} />)}</span>
        <span>{text}</span>
      </span>
    );
  };

  const rows: { key: Key; title: string; empty: string; items: (Item & { count?: number; person?: FilterPerson })[] }[] = [
    { key: "people", title: "People", empty: "Everyone", items: people.map((p) => ({ id: p.id, name: p.first, count: p.count, person: p })) },
    { key: "occasions", title: "Occasions", empty: "Any occasion", items: occasions },
    { key: "decades", title: "Decades", empty: "Any decade", items: decades.map((d) => ({ id: d, name: `${d}s` })) },
  ];

  return (
    <div className={`si${showBook ? "" : " no-book"}`}>
      <Link href="/" className="back-link si-back"><Icon name="chevronLeft" size={16} /> Home</Link>
      <div className="si-head">
        <BookSketch height={92} />
        <div>
          <h1>In Her Words</h1>
          <p>Dunya answers the questions we&apos;ve always wanted to ask · {stories.length} {stories.length === 1 ? "story" : "stories"}</p>
          <Link href="/stories/submit?from=stories" className="si-submit"><Icon name="plus" size={16} stroke={2.2} />Submit a story</Link>
        </div>
      </div>

      <div className="si-tools">
        <div className={`si-filters${open ? " open" : ""}`} ref={wrap}>
          <button type="button" className="si-fbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
            <Icon name="filters" size={18} />
            <span className="si-flabel">{barLabel}</span>
            <span className="si-fchev" aria-hidden="true"><Icon name="chevronDown" size={16} stroke={2} /></span>
          </button>
          {open && (
            <div className="si-panel">
              <div className="si-ptop">
                <span>Find stories that mention…</span>
                <button type="button" className="bf-clear" disabled={!nPicked} onClick={clear}>Clear all</button>
              </div>
              {rows.map((r) => {
                const on = section === r.key;
                const picked = sel[r.key];
                const shown = r.key === "people" && !allPeople ? r.items.filter((it, i) => i < SHOW || picked.includes(it.id)) : r.items;
                return (
                  <div key={r.key} className={`fg${on ? " open" : ""}`}>
                    <button type="button" className="fg-row" aria-expanded={on} onClick={() => setSection(on ? null : r.key)}>
                      <span className="fg-text">
                        <span className="fg-label">{r.title}</span>
                        <span className="fg-hint">{picked.length ? picked.map(names[r.key]).join(", ") : r.empty}</span>
                      </span>
                      <span className="fg-chev" aria-hidden="true"><Icon name="chevronDown" size={16} stroke={2} /></span>
                    </button>
                    {on && (
                      <fieldset className="fg-list">
                        <legend className="sr-only">{r.title}</legend>
                        {!r.items.length && <p className="small muted">None yet.</p>}
                        {shown.map((it) => (
                          <label key={it.id} className="check si-check">
                            <input type="checkbox" checked={picked.includes(it.id)} onChange={() => toggle(r.key, it.id)} />
                            <span className="box" aria-hidden="true"><Icon name="check" size={14} stroke={2.4} /></span>
                            <span className="si-name">{it.name}</span>
                            {it.count !== undefined && <span className="si-count" aria-label={`${it.count} ${it.count === 1 ? "story" : "stories"}`}>{it.count}</span>}
                          </label>
                        ))}
                        {r.key === "people" && !allPeople && r.items.length > shown.length && (
                          <button type="button" className="fg-more" onClick={() => setAllPeople(true)}>Show all people</button>
                        )}
                      </fieldset>
                    )}
                  </div>
                );
              })}
              <button type="button" className="bf-close si-close" onClick={() => setOpen(false)}>
                <Icon name="chevronUp" size={16} stroke={2} /> {nPicked ? `Show ${list.length} ${list.length === 1 ? "story" : "stories"}` : "Close filters"}
              </button>
            </div>
          )}
        </div>
        <div className="si-chips" role="group" aria-label="Themes">
          <button type="button" className={`si-chip${!theme ? " on" : ""}`} aria-pressed={!theme} onClick={() => setTheme(null)}>All</button>
          {THEMES.map(([v, l]) => (
            <button key={v} type="button" className={`si-chip${theme === v ? " on" : ""}`} aria-pressed={theme === v} onClick={() => setTheme(theme === v ? null : v)}>{l}</button>
          ))}
        </div>
      </div>

      {filtered && list.length > 0 && <p className="si-count-line">{list.length} {list.length === 1 ? "story" : "stories"}</p>}

      {list.length ? (
        <div className={`si-grid${featured ? " with-featured" : ""}`}>
          {featured && (
            <Link href={`/stories/${featured.id}${from}`} className="sc sc-featured">
              <CardPhoto url={featured.photoUrl} className="sc-photo" />
              <span className="sc-text">
                <span className="sc-theme">{featured.themeLabel}</span>
                <span className="sc-title">{featured.title}</span>
                <span className="sc-time">{featured.minutes} min read</span>
              </span>
            </Link>
          )}
          {rest.map((s) => (
            <Link key={s.id} href={`/stories/${s.id}${from}`} className="sc">
              <CardPhoto url={s.photoUrl} className="sc-photo" />
              <span className="sc-text">
                <span className="sc-theme">{s.themeLabel}</span>
                <span className="sc-title">{s.title}</span>
                {sel.people.length > 0 && matched(s)}
                <span className="sc-time">{s.minutes} min read</span>
              </span>
            </Link>
          ))}
        </div>
      ) : stories.length ? (
        <div className="si-empty">
          <p>No stories match these filters.</p>
          <button type="button" className="btn" onClick={() => { clear(); setTheme(null); }}>Clear filters</button>
        </div>
      ) : <p className="muted">Her stories are on their way.</p>}

      {showBook && <div className="si-book" role="region" aria-label="Printed book">
        <span className="si-book-text"><Icon name="book" size={20} /> These stories are becoming a printed book.</span>
        {canWant && (
          <button type="button" className={`si-want${want ? " on" : ""}`} aria-pressed={want} onClick={toggleWant}>
            {want ? "You’re on the list" : "I’d want a copy"}
          </button>
        )}
      </div>}
    </div>
  );
}
