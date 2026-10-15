"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export type Pickable = { id: number; name: string; avatarUrl: string | null };

/** The small Polaroid of Dunya at the top of the sign-in picker. */
function Polaroid({ photo }: { photo: string | null }) {
  return (
    <div className="who-polaroid" role="img" aria-label="Dunya as a young woman">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" /> : <span />}
    </div>
  );
}

/**
 * "Who are you?": the people who can sign in, as a grid of tiles in family order. The search and the button stay
 * at the top while the grid scrolls. There's no way to add yourself; Mary adds people.
 */
export function WhoPicker({ people, photo, initial = null, busy, error, onContinue, cancel }: {
  people: Pickable[]; photo: string | null; initial?: number | null; busy: boolean; error: string;
  onContinue: (personId: number) => void; cancel: React.ReactNode;
}) {
  const [picked, setPicked] = useState<number | null>(initial && people.some((p) => p.id === initial) ? initial : null);
  const [filter, setFilter] = useState("");
  const f = filter.trim().toLowerCase();
  const shown = f ? people.filter((p) => p.name.toLowerCase().includes(f)) : people;
  const who = people.find((p) => p.id === picked);
  return (
    <form className="who" onSubmit={(e) => { e.preventDefault(); if (picked) onContinue(picked); }}>
      <Polaroid photo={photo} />
      <h1>Who are you?</h1>
      <p className="who-sub">Pick yourself so the family knows who shared what.</p>
      <div className="who-bar">
        <label className="who-find">
          <Icon name="search" size={18} />
          <input aria-label="Find your name" placeholder="Find your name" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </label>
        <button type="submit" className="who-go" disabled={!who || busy}>
          {busy ? "One moment" : who ? `Continue as ${who.name}` : "Pick your name"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="who-grid" role="group" aria-label="Family members">
        {shown.map((p) => (
          <button key={p.id} type="button" className={`who-tile${p.id === picked ? " on" : ""}`} aria-pressed={p.id === picked} onClick={() => setPicked(p.id)}>
            <span className="who-avatar" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
            </span>
            {p.name}
          </button>
        ))}
        {shown.length === 0 && <p className="muted who-none">No one by that name can sign in. Ask Mary to add you.</p>}
      </div>
      <div className="who-cancel">{cancel}</div>
    </form>
  );
}
