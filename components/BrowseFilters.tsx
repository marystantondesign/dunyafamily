"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";

type Item = { id: number; name: string };
const SHOW = 8;

/** Sidebar checkboxes. Each change updates the URL, so filters can be shared and the back button works. */
export function BrowseFilters({ people, occasions, decades, selected, params }: {
  people: Item[]; occasions: Item[]; decades: number[];
  selected: { people: number[]; occasions: number[]; decades: number[] };
  params: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function toggle(key: "people" | "occasions" | "decade", list: number[], id: number) {
    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    const qs = new URLSearchParams(params);
    qs.delete("page");
    if (next.length) qs.set(key, next.join(",")); else qs.delete(key);
    if (key === "decade") qs.delete("year");
    router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
  }

  const group = (title: string, key: "people" | "occasions" | "decade", items: Item[], list: number[]) => (
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
        {group("People", "people", people, selected.people)}
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

export function SortSelect({ value, params }: { value: string; params: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="sort">
      <span>Sort:</span>
      <select
        value={value}
        onChange={(e) => {
          const qs = new URLSearchParams(params);
          qs.delete("page");
          if (e.target.value === "oldest") qs.set("order", "oldest"); else qs.delete("order");
          router.push(`/browse${qs.size ? `?${qs}` : ""}`, { scroll: false });
        }}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </label>
  );
}
