"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Star } from "./Star";
import { QBadge } from "./TaggingNeeded";

type Item = { id: number; name: string };
type Key = "people" | "albums" | "occasions" | "decade";
const SHOW = 8;

/** The sort options, in this order everywhere. "recent" is upload time. */
export const SORTS: { value: string; label: string }[] = [
  { value: "shuffled", label: "Shuffled" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "activity", label: "Recent activity" },
  { value: "recent", label: "Recently uploaded" },
];

/** Go to a sort. Picking Shuffled again shuffles again. */
function useSort(value: string, fallback: string, params: Record<string, string>) {
  const router = useRouter();
  return (next: string) => {
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (next === "shuffled" && value === "shuffled") {
      document.cookie = `df_shuffle=${Math.random().toString(36).slice(2, 10)}; path=/; samesite=lax`;
      router.refresh();
      return;
    }
    if (next === fallback) qs.delete("order"); else qs.set("order", next);
    router.push(`${window.location.pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
  };
}

/** The sort options as a list, with a check and a tint on the current one. */
function SortList({ value, onPick, className }: { value: string; onPick: (v: string) => void; className: string }) {
  return (
    <div role="listbox" aria-label="Sort photos" className={className}>
      {SORTS.map((o) => (
        <button key={o.value} type="button" role="option" aria-selected={o.value === value} className={`sort-opt${o.value === value ? " on" : ""}`} onClick={() => onPick(o.value)}>
          <span className="sort-check" aria-hidden="true">{o.value === value && <Icon name="check" size={16} stroke={2.2} />}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const sortLabel = (value: string) => SORTS.find((o) => o.value === value)?.label ?? (value === "favorited" ? "Newest favorited" : "Shuffled");

/** Desktop: the sort dropdown in the toolbar, next to Select. */
export function SortMenu({ value, fallback, params }: { value: string; fallback: string; params: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const go = useSort(value, fallback, params);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className="sort-menu" ref={wrap}>
      <span className="sort-word">Sort</span>
      <div className="sort-anchor">
        <button type="button" className={`sort-btn wide${open ? " open" : ""}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span>{sortLabel(value)}</span>
          <Icon name="chevronDown" size={18} className="sort-chev" />
        </button>
        {open && <SortList value={value} onPick={(v) => { setOpen(false); go(v); }} className="sort-list pop" />}
      </div>
    </div>
  );
}

/**
 * Filters. Phones: a bar that opens a panel attached below it (Sort and Clear all on top, then People, Albums,
 * Occasions, and Decades as rows, then Close filters). Desktop: the side panel. Each pick updates the URL, so filters
 * can be shared and the back button works. One category row is open at a time.
 */
export function BrowseFilters({ people, occasions, decades, albums, selected, params, sort, favorites, tagging }: {
  people: Item[]; occasions: Item[]; decades: number[]; albums: Item[];
  /** On phones, Sort lives in the filters panel. */
  sort: { value: string; fallback: string };
  selected: { people: number[]; occasions: number[]; decades: number[]; albums: number[] };
  params: Record<string, string>;
  /** Whether "Your favorites" is on. */
  favorites: boolean;
  /** Whether "Tagging needed" is on, and how many photos are marked. */
  tagging: { on: boolean; count: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Key | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const goSort = useSort(sort.value, sort.fallback, params);
  const count = selected.people.length + selected.albums.length + selected.occasions.length + selected.decades.length;

  const push = (qs: URLSearchParams) => router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });

  function toggle(key: Key, list: number[], id: number) {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (next.length) qs.set(key, next.join(",")); else qs.delete(key);
    if (key === "decade") qs.delete("year");
    push(qs);
  }

  /** Phones: clear every category, keeping the sort, search, Favorites, and Tagging needed. */
  function clearCategories() {
    const qs = new URLSearchParams(params);
    for (const k of ["people", "albums", "occasions", "decade", "year", "page"]) qs.delete(k);
    push(qs);
  }

  function toggleFavorites() {
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (favorites) { qs.delete("favorites"); if (qs.get("order") === "favorited") qs.delete("order"); } else qs.set("favorites", "1");
    push(qs);
  }

  function toggleTagging() {
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (tagging.on) qs.delete("tagging"); else qs.set("tagging", "1");
    push(qs);
  }

  const plural = (n: number, one: string, many: string) => `All ${n} ${n === 1 ? one : many}`;
  const cats: { key: Key; title: string; items: Item[]; checked: number[]; all: string }[] = [
    { key: "people", title: "People", items: people, checked: selected.people, all: plural(people.length, "person", "people") },
    ...(albums.length ? [{ key: "albums" as const, title: "Albums", items: albums, checked: selected.albums, all: "All albums" }] : []),
    { key: "occasions", title: "Occasions", items: occasions, checked: selected.occasions, all: plural(occasions.length, "occasion", "occasions") },
    ...(decades.length ? [{ key: "decade" as const, title: "Decades", items: decades.map((d) => ({ id: d, name: `${d}s` })), checked: selected.decades, all: plural(decades.length, "decade", "decades") }] : []),
  ];

  return (
    <div className={`bf${open ? " open" : ""}`}>
      <button type="button" className="bf-toggle" aria-expanded={open} aria-controls="browse-filters" onClick={() => { setOpen(!open); setSortOpen(false); }}>
        <Icon name="filters" size={20} />
        <span className="bf-toggle-label">Filters</span>
        {count > 0 && <span className="bf-badge" aria-label={`${count} selected`}>{count}</span>}
        <span className="bf-chev" aria-hidden="true"><Icon name="chevronDown" size={18} stroke={2} /></span>
      </button>
      <aside id="browse-filters" className="filters" aria-label="Filters">
        <div className="filters-head desktop-only">
          <h2>Filters</h2>
          <a href="/browse" className="small">Clear all</a>
        </div>
        <label className={`fav-filter desktop-only${favorites ? " on" : ""}`}>
          <input type="checkbox" checked={favorites} onChange={toggleFavorites} />
          <Star on={favorites} size={16} /> Your favorites
        </label>
        <label className={`tn-filter desktop-only${tagging.on ? " on" : ""}`}>
          <input type="checkbox" checked={tagging.on} onChange={toggleTagging} />
          <QBadge size={22} /> <span>Tagging needed</span>
          {tagging.count > 0 && <span className="tn-count">{tagging.count}</span>}
        </label>

        <div className="bf-panel">
          <div className="bf-sortrow phone-only">
            <span className="bf-sortword">Sort</span>
            <button type="button" className={`sort-btn${sortOpen ? " open" : ""}`} aria-haspopup="listbox" aria-expanded={sortOpen} onClick={() => setSortOpen(!sortOpen)}>
              <Icon name="sort" size={18} /> {sortLabel(sort.value)} <Icon name="chevronDown" size={16} stroke={2} className="sort-chev" />
            </button>
            <button type="button" className="bf-clear" disabled={count === 0} onClick={clearCategories}>Clear all</button>
          </div>
          {sortOpen && <SortList value={sort.value} onPick={(v) => { setSortOpen(false); goSort(v); }} className="sort-list inline phone-only" />}

          <div className="bf-cats">
            {cats.map((c) => (
              <FilterGroup key={c.key} title={c.title} items={c.items} checked={c.checked} all={c.all}
                open={section === c.key} onOpen={() => setSection(section === c.key ? null : c.key)}
                onToggle={(id) => toggle(c.key, c.checked, id)} />
            ))}
          </div>
          <button type="button" className="bf-close phone-only" onClick={() => { setOpen(false); setSortOpen(false); }}>
            <Icon name="chevronUp" size={18} stroke={2} /> Close filters
          </button>
        </div>
      </aside>
    </div>
  );
}

/** One category: label, a hint ("All 79 people", or the picks), and the chevron; checkboxes when open. */
function FilterGroup({ title, items, checked, all, open, onOpen, onToggle }: {
  title: string; items: Item[]; checked: number[]; all: string; open: boolean; onOpen: () => void; onToggle: (id: number) => void;
}) {
  const [every, setEvery] = useState(false);
  const picked = items.filter((it) => checked.includes(it.id)).map((it) => it.name);
  // Checked items always show, even past the first few.
  const shown = every ? items : items.filter((it, i) => i < SHOW || checked.includes(it.id));
  const id = `fg-${title.toLowerCase()}`;
  return (
    <div className={`fg${open ? " open" : ""}`}>
      <button type="button" className="fg-row" aria-expanded={open} aria-controls={id} onClick={onOpen}>
        <span className="fg-text">
          <span className="fg-label">{title}</span>
          <span className="fg-hint">{picked.length ? picked.join(", ") : all}</span>
        </span>
        <span className="fg-chev" aria-hidden="true"><Icon name="chevronDown" size={18} stroke={2} /></span>
      </button>
      {open && (
        <fieldset id={id} className="fg-list">
          <legend className="sr-only">{title}</legend>
          {shown.map((it) => (
            <label key={it.id} className="check">
              <input type="checkbox" checked={checked.includes(it.id)} onChange={() => onToggle(it.id)} />
              <span className="box" aria-hidden="true"><Icon name="check" size={14} stroke={2.4} /></span>
              {it.name}
            </label>
          ))}
          {items.length > shown.length && (
            <button type="button" className="fg-more" onClick={() => setEvery(true)}>Show all {items.length}</button>
          )}
        </fieldset>
      )}
    </div>
  );
}
