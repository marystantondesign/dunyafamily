"use client";
import Link from "next/link";
import { useState } from "react";
import type { RecipeCard, RecipeFrom } from "@/lib/recipes";
import { RecipeCardImage } from "./Sketches";

export function Face({ from, size = 22 }: { from: Pick<RecipeFrom, "name" | "avatarUrl">; size?: number }) {
  return (
    <span className="rc-face" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {from.avatarUrl ? <img src={from.avatarUrl} alt="" /> : from.name.charAt(0).toUpperCase()}
    </span>
  );
}

const notes = (n: number) => `${n} ${n === 1 ? "note" : "notes"}`;

/** Filter pills (Everyone, then each person with a recipe) and the grid of cards. */
export function RecipeGrid({ recipes }: { recipes: RecipeCard[] }) {
  const [who, setWho] = useState<number | null>(null);
  const people: { id: number; name: string }[] = [];
  for (const r of recipes) if (r.from?.personId && !people.some((p) => p.id === r.from!.personId)) people.push({ id: r.from.personId, name: r.from.name });
  people.sort((a, b) => a.name.localeCompare(b.name));
  const shown = who == null ? recipes : recipes.filter((r) => r.from?.personId === who);
  return (
    <>
      {people.length > 0 && (
        <div className="rb-pills" role="group" aria-label="Whose recipes">
          <button type="button" aria-pressed={who == null} onClick={() => setWho(null)}>Everyone</button>
          {people.map((p) => <button key={p.id} type="button" aria-pressed={who === p.id} onClick={() => setWho(p.id)}>{p.name}</button>)}
        </div>
      )}
      <div className="rb-grid">
        {shown.map((r) => (
          <Link key={r.id} href={`/recipes/${r.id}`} className="rb-card">
            <RecipeCardImage url={r.photoUrl} title={r.title} />
            <div>
              <div className="rb-title">{r.title}</div>
              <div className="rb-meta">
                {r.from && <><Face from={r.from} /><span>From {r.from.name}</span><span aria-hidden="true">·</span></>}
                <span>{notes(r.notes)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
