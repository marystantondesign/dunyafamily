"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
import { Star } from "./Star";
import { QBadge } from "./TaggingNeeded";

type Item = { id: number; name: string };
const SHOW = 8;

/** Sidebar checkboxes. Each change updates the URL, so filters can be shared and the back button works. */
export function BrowseFilters({ people, occasions, decades, albums, selected, params, sort, favorites, tagging }: {
  people: Item[]; occasions: Item[]; decades: number[]; albums: Item[];
  /** On phones, Sort lives in the filters panel. */
  sort?: { value: string; fallback: string };
  selected: { people: number[]; occasions: number[]; decades: number[]; albums: number[] };
  params: Record<string, string>;
  /** Whether "Your favorites" is on. */
  favorites: boolean;
  /** Whether "Tagging needed" is on, and how many photos are marked. */
  tagging: { on: boolean; count: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function toggle(key: "people" | "occasions" | "decade" | "albums", list: number[], id: number) {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (next.length) qs.set(key, next.join(",")); else qs.delete(key);
    if (key === "decade") qs.delete("year");
    router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  function toggleFavorites() {
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (favorites) { qs.delete("favorites"); if (qs.get("order") === "favorited") qs.delete("order"); } else qs.set("favorites", "1");
    router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  function toggleTagging() {
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (tagging.on) qs.delete("tagging"); else qs.set("tagging", "1");
    router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  const group = (title: string, key: "people" | "occasions" | "decade" | "albums", items: Item[], list: number[]) => (
    <FilterGroup title={title} items={items} checked={list} onToggle={(id) => toggle(key, list, id)} />
  );

  return (
    <>
      <button type="button" className="btn filters-toggle" aria-expanded={open} aria-controls="browse-filters" onClick={() => setOpen(!open)}>
        <Icon name="filters" size={18} /> Filters
      </button>
      <aside id="browse-filters" className={`filters${open ? " open" : ""}`} aria-label="Filters">
        <div className="filters-head">
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
        {sort && <div className="phone-only"><SortSelect value={sort.value} fallback={sort.fallback} params={params} favorites={favorites} /></div>}
        {group("People", "people", people, selected.people)}
        {albums.length > 0 && group("Albums", "albums", albums, selected.albums)}
        {group("Occasions", "occasions", occasions, selected.occasions)}
        {decades.length > 0 && group("Decades", "decade", decades.map((d) => ({ id: d, name: `${d}s` })), selected.decades)}
      </aside>
    </>
  );
}

function FilterGroup({ title, items, checked, onToggle }: { title: string; items: Item[]; checked: number[]; onToggle: (id: number) => void }) {
  const [all, setAll] = useState(false);
  // Checked items always show, even past the first few.
  const shown = all ? items : items.filter((it, i) => i < SHOW || checked.includes(it.id));
  return (
    <details className="filter-group" open>
      <summary>{title}<Icon name="chevronDown" size={18} className="chev" /></summary>
      <fieldset>
        <legend className="sr-only">{title}</legend>
        {shown.map((it) => (
          <label key={it.id} className="check">
            <input type="checkbox" checked={checked.includes(it.id)} onChange={() => onToggle(it.id)} />
            <span className="box" aria-hidden="true"><Icon name="check" size={14} stroke={2.4} /></span>
            {it.name}
          </label>
        ))}
        {items.length > shown.length && (
          <button type="button" className="link-btn" onClick={() => setAll(true)}>Show all {items.length}</button>
        )}
      </fieldset>
    </details>
  );
}

export function SortSelect({ value, fallback, params, favorites }: { value: string; fallback: string; params: Record<string, string>; favorites?: boolean }) {
  const router = useRouter();
  return (
    <label className="sort">
      <span>Sort</span>
      <select
        value={value}
        onChange={(e) => {
          const qs = new URLSearchParams(params);
          qs.delete("page");
          if (e.target.value === fallback) qs.delete("order"); else qs.set("order", e.target.value);
          router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
        }}
      >
        <option value="shuffled">Shuffled</option>
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        {favorites && <option value="favorited">Newest favorited</option>}
      </select>
    </label>
  );
}
