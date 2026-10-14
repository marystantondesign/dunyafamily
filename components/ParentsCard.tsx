"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Edit details (admin): who this person's parents are. One parent is fine; the second is optional and can be cleared. */
export function ParentsCard({ personId, name, parents }: { personId: number; name: string; parents: { id: number; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function remove(p: { id: number; name: string }) {
    if (!confirm(`Take ${p.name} off as ${name}'s parent? Both stay in the family.`)) return;
    setError("");
    const res = await fetch("/api/admin/family", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", personId, otherId: p.id, kind: "parent" }) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    router.refresh();
  }
  return (
    <section className="edit-card" id="parents">
      <h2>Parents</h2>
      {parents.length ? (
        <ul className="ep-parents">
          {parents.map((p) => (
            <li key={p.id}>
              <Link href={`/people/${p.id}`}>{p.name}</Link>
              <button type="button" className="link-btn danger" onClick={() => remove(p)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="muted">No parents added yet.</p>}
      <p className="hint">One parent is enough. Add a second parent only when they&apos;re known and on the site; otherwise leave it empty and {name} hangs straight from their parent on the tree.</p>
      <Link href={`/admin/family?person=${personId}`} className="small">{parents.length < 2 ? "Add a parent" : "Change parents"} in Family tree</Link>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
