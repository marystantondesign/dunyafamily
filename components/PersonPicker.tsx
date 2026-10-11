"use client";
import { useState } from "react";

export type Pickable = { id: number; name: string; avatarUrl: string | null };
export type Picked = { personId: number } | { newName: string } | null;

/** "Which one is you?": a grid of the family, plus "I'm not on the list yet" for someone new. */
export function PersonPicker({ people, value, onChange }: { people: Pickable[]; value: Picked; onChange: (v: Picked) => void }) {
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("");
  const shown = filter.trim() ? people.filter((p) => p.name.toLowerCase().includes(filter.trim().toLowerCase())) : people;
  return (
    <fieldset className="picker">
      <legend>Which one is you?</legend>
      {people.length > 12 && (
        <input className="picker-filter" aria-label="Find your name" placeholder="Find your name" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      <div className="picker-grid">
        {shown.map((p) => {
          const on = !!value && "personId" in value && value.personId === p.id;
          return (
            <button key={p.id} type="button" className={`picker-card${on ? " on" : ""}`} aria-pressed={on} onClick={() => { setAdding(false); onChange({ personId: p.id }); }}>
              <span className="picker-avatar" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
              </span>
              <span className="picker-name">{p.name}</span>
            </button>
          );
        })}
      </div>
      {adding ? (
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="new-me">Your name</label>
          <input id="new-me" autoFocus autoComplete="given-name" value={value && "newName" in value ? value.newName : ""} onChange={(e) => onChange({ newName: e.target.value })} />
          <span className="hint">You&apos;ll be added to the family list.</span>
        </div>
      ) : (
        <button type="button" className="text-btn picker-new" onClick={() => { setAdding(true); onChange({ newName: "" }); }}>I&apos;m not on the list yet</button>
      )}
    </fieldset>
  );
}

export const pickedName = (v: Picked, people: Pickable[]) =>
  !v ? "" : "personId" in v ? people.find((p) => p.id === v.personId)?.name ?? "" : v.newName.trim().split(" ")[0];
