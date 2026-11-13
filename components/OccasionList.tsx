"use client";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/** Each occasion with its photo count and Remove. */
export function OccasionList({ rows }: { rows: { id: number; name: string; n: number }[] }) {
  const [list, setList] = useState(rows);
  const [asking, setAsking] = useState<{ id: number; name: string; n: number } | null>(null);
  const [error, setError] = useState("");
  async function remove(id: number) {
    setError("");
    const res = await fetch(`/api/admin/occasions/${id}`, { method: "DELETE" });
    if (res.ok) setList((cur) => cur.filter((r) => r.id !== id));
    else setError("That didn't work. Try again.");
  }
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="oc-list">
        {list.map((r) => (
          <li key={r.id}>
            <span><strong>{r.name}</strong><span>{r.n} {r.n === 1 ? "photo" : "photos"}</span></span>
            <button type="button" className="btn oc-remove" onClick={() => setAsking(r)}>Remove</button>
          </li>
        ))}
      </ul>
      {asking && (
        <ConfirmDialog title={`Remove ${asking.name}?`}
          body={`It comes out of the filters${asking.n ? ` and off ${asking.n} ${asking.n === 1 ? "photo" : "photos"}` : ""}. The photos stay on the site.`}
          keep="Keep it" confirm="Remove" onKeep={() => setAsking(null)} onConfirm={() => { const id = asking.id; setAsking(null); remove(id); }} />
      )}
    </>
  );
}
