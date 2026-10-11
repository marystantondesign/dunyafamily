"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Relation } from "@/lib/family";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type Kind = "parent" | "partner" | "child";
const ROWS: { kind: Kind; label: string; key: "parents" | "partners" | "children"; add: string }[] = [
  { kind: "parent", label: "Parents", key: "parents", add: "Add a parent" },
  { kind: "partner", label: "Partner", key: "partners", add: "Add a partner" },
  { kind: "child", label: "Children", key: "children", add: "Add a child" },
];

/** The Family card on Edit a person (screen 18). Changes here save right away. */
export function FamilyEditor({ personId, name, rel, people, canUnfriend }: {
  personId: number; name: string; people: Option[]; canUnfriend: boolean;
  rel: { parents: Relation[]; partners: Relation[]; children: Relation[]; friend: boolean };
}) {
  const router = useRouter();
  const [open, setOpen] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
      setOpen(null);
      router.refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  const linked = new Set([personId, ...rel.parents, ...rel.partners, ...rel.children].map((r) => (typeof r === "number" ? r : r.person.id)));
  const options = people.filter((p) => !linked.has(p.id));

  return (
    <section className="edit-card" id="family">
      <h2>Family</h2>
      <ul className="rel-list">
        {ROWS.map((row) => (
          <li key={row.kind}>
            <span className="rel-label">{row.label}</span>
            <span className="rel-people">
              {rel[row.key].map((r) => (
                <span key={r.relId} className="rel-chip">
                  <Link href={`/people/${r.person.id}`}>
                    <span className="chip-avatar" aria-hidden="true">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.person.avatarUrl ? <img src={r.person.avatarUrl} alt="" /> : r.person.name.charAt(0)}
                    </span>
                    {r.person.name}
                  </Link>
                  {r.removable && (
                    <button type="button" aria-label={`Take ${r.person.name} off as ${name}'s ${row.kind}`} disabled={busy}
                      onClick={() => confirm(`Take ${r.person.name} off as ${name}'s ${row.kind}? Both stay in the family.`) && send(`/api/relations/${r.relId}`, "DELETE")}>×</button>
                  )}
                </span>
              ))}
              {!rel[row.key].length && open !== row.kind && <span className="muted small">None added</span>}
            </span>
            {open === row.kind ? null : (
              <button type="button" className="text-btn rel-add" onClick={() => { setOpen(row.kind); setError(""); }}>Add</button>
            )}
            {open === row.kind && (
              <div className="rel-picker">
                <TagPicker label={row.add} options={options} value={[]} placeholder="Start typing a name"
                  onChange={(v: Picked[]) => { const last = v[v.length - 1]; if (last !== undefined) send(`/api/people/${personId}/relations`, "POST", { kind: row.kind, other: last }); }} />
                <button type="button" className="text-btn quiet" onClick={() => setOpen(null)}>Cancel</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <label className="switch-row">
        <input type="checkbox" role="switch" className="switch" checked={rel.friend} disabled={busy || (rel.friend && !canUnfriend)}
          onChange={(e) => send(`/api/people/${personId}/relations`, "POST", { kind: "friend", on: e.target.checked })} />
        Friend of the family
      </label>
      <p className="hint">Family changes save right away. A new name typed here is added to the family.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
