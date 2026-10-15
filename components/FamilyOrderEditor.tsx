"use client";
import { useState } from "react";
import { Icon } from "./Icon";

type P = { id: number; name: string };

/** Move people up and down, between the two parts, or out of the order. Saved all at once. */
export function FamilyOrderEditor({ main: m0, earlier: e0, others }: { main: P[]; earlier: P[]; others: P[] }) {
  const [main, setMain] = useState(m0);
  const [earlier, setEarlier] = useState(e0);
  const [add, setAdd] = useState("");
  const [state, setState] = useState<"" | "saving" | "saved" | string>("");
  const listed = new Set([...main, ...earlier].map((p) => p.id));
  const pool = others.filter((p) => !listed.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));

  const move = (list: P[], set: (l: P[]) => void, i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
    setState("");
  };

  async function save() {
    setState("saving");
    const res = await fetch("/api/admin/order", { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ main: main.map((p) => p.id), earlier: earlier.map((p) => p.id) }) });
    setState(res.ok ? "saved" : (await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
  }

  const section = (title: string, list: P[], set: (l: P[]) => void, other: { label: string; to: (p: P) => void }) => (
    <section className="edit-card">
      <h2>{title}</h2>
      <ol className="order-list">
        {list.map((p, i) => (
          <li key={p.id}>
            <span className="order-n">{i + 1}</span>
            <span className="order-name">{p.name}</span>
            <button type="button" className="icon-btn" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(list, set, i, -1)}><Icon name="chevronUp" size={18} /></button>
            <button type="button" className="icon-btn" aria-label={`Move ${p.name} down`} disabled={i === list.length - 1} onClick={() => move(list, set, i, 1)}><Icon name="chevronDown" size={18} /></button>
            <button type="button" className="text-btn small" onClick={() => { set(list.filter((x) => x.id !== p.id)); other.to(p); setState(""); }}>{other.label}</button>
            <button type="button" className="text-btn small" onClick={() => { set(list.filter((x) => x.id !== p.id)); setState(""); }}>Take out</button>
          </li>
        ))}
      </ol>
    </section>
  );

  return (
    <div className="order-editor">
      {section("Dunya and her family", main, setMain, { label: "Move to earlier", to: (p) => setEarlier((l) => [...l, p]) })}
      {section("Parents, brothers and sisters, grandparents", earlier, setEarlier, { label: "Move to family", to: (p) => setMain((l) => [...l, p]) })}
      <div className="field">
        <label htmlFor="order-add">Add someone to the end of Dunya and her family</label>
        <div className="order-add">
          <select id="order-add" value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="">Choose a person</option>
            {pool.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" className="btn" disabled={!add} onClick={() => { const p = pool.find((x) => x.id === Number(add)); if (p) setMain((l) => [...l, p]); setAdd(""); setState(""); }}>Add</button>
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving" : "Save order"}</button>
        {state === "saved" && <span className="muted small" role="status">Saved</span>}
        {state && state !== "saving" && state !== "saved" && <p className="error" role="alert">{state}</p>}
      </div>
    </div>
  );
}
