"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Halo } from "./Halo";
import { Icon } from "./Icon";
import { TagPicker, type Picked } from "./TagPicker";

type P = { id: number; name: string; avatarUrl: string | null; inMemory: boolean; birthYear?: number | null; aliases?: string[] };
type Row = { person: P; role: string };
type Kind = "parent" | "sibling" | "partner" | "child";
export type AdminData = { person: P & { birthYear: number | null; friend: boolean; coparent: boolean }; parents: Row[]; siblings: Row[]; partners: Row[]; children: Row[] };

const ROLE_SETS: Record<Kind, string[]> = {
  parent: ["mother", "father", "parent"], sibling: ["sister", "brother", "sibling"], partner: ["spouse", "former_spouse", "partner", "former_partner"], child: ["daughter", "son", "child"],
};
const ALL_ROLES = ["mother", "father", "parent", "sister", "brother", "sibling", "partner", "spouse", "daughter", "son", "child"];
const NAMES: Record<string, string> = { spouse: "Husband or wife", former_spouse: "Former husband or wife", partner: "Partner", former_partner: "Former partner" };
const cap = (w: string) => NAMES[w] ?? w.charAt(0).toUpperCase() + w.slice(1);
const kindOf = (role: string): Kind => (Object.entries(ROLE_SETS).find(([, r]) => r.includes(role))?.[0] as Kind) ?? "child";

async function send(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/family", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
}

function Face({ p, size = 38 }: { p: P; size?: number }) {
  return (
    <Halo on={p.inMemory} name={p.name}>
      <span className="fa-face" style={{ width: size, height: size }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
      </span>
    </Halo>
  );
}

/** Who's being edited: a searchable list of everyone. */
function PersonSelect({ current, everyone, onPick }: { current: P; everyone: P[]; onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const t = text.trim().toLowerCase();
  const list = everyone.filter((p) => !t || [p.name, ...(p.aliases ?? [])].some((n) => n.toLowerCase().includes(t)));
  return (
    <div className="fa-select" ref={box}>
      <button type="button" className="fa-select-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Face p={current} size={32} /> <span>{current.name}</span> <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="fa-select-pop">
          <input autoFocus placeholder="Find a person" value={text} onChange={(e) => setText(e.target.value)} aria-label="Find a person"
            onKeyDown={(e) => { if (e.key === "Enter" && list[0]) { onPick(list[0].id); setOpen(false); } }} />
          <ul role="listbox" aria-label="People">
            {list.map((p) => (
              <li key={p.id}><button type="button" role="option" aria-selected={p.id === current.id} onClick={() => { onPick(p.id); setOpen(false); }}>
                <Face p={p} size={26} /> {p.name}
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Family tree editor (admin): one person at a time, their parents, brothers and sisters, partners, and children. */
export function FamilyAdmin({ data, everyone }: { data: AdminData; everyone: P[] }) {
  const router = useRouter();
  const me = data.person;
  const [error, setError] = useState("");
  const [who, setWho] = useState<Picked[]>([]);
  const [role, setRole] = useState("parent");
  const [birth, setBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [kids, setKids] = useState(data.children);
  const [dragging, setDragging] = useState<number | null>(null);
  const kidList = useRef<HTMLUListElement>(null);
  const whoBox = useRef<HTMLDivElement>(null);
  useEffect(() => setKids(data.children), [data.children]);

  async function run(body: Record<string, unknown>) {
    setError("");
    try { await send(body); router.refresh(); return true; } catch (e) { setError((e as Error).message); return false; }
  }
  const switchTo = (id: number) => router.push(`/admin/family?person=${id}`);

  function startAdd(r: string) {
    setRole(r);
    whoBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => whoBox.current?.querySelector("input")?.focus(), 250);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!who.length) return setError("Choose someone, or type a new name.");
    setBusy(true);
    if (await run({ action: "connect", personId: me.id, other: who[0], role, birth })) { setWho([]); setBirth(""); }
    setBusy(false);
  }

  function remove(kind: Kind, p: P) {
    const what = kind === "sibling" ? "brother or sister" : kind;
    if (confirm(`Take ${p.name} off as ${me.name}'s ${what}? Both stay in the family.`)) run({ action: "remove", personId: me.id, otherId: p.id, kind });
  }

  // Children: dated ones sort by year; drag places anyone without one.
  function saveKids(list: Row[]) { run({ action: "order", ids: list.map((k) => k.person.id) }); }
  function sortByYear(list: Row[]) {
    const dated = list.filter((k) => k.person.birthYear).sort((a, b) => a.person.birthYear! - b.person.birthYear!);
    let i = 0;
    return list.map((k) => (k.person.birthYear ? dated[i++] : k));
  }
  function onDragMove(e: React.PointerEvent, id: number) {
    if (dragging !== id || !kidList.current) return;
    const rows = [...kidList.current.querySelectorAll<HTMLElement>("[data-kid]")];
    let to = rows.length - 1;
    for (const [i, r] of rows.entries()) { const b = r.getBoundingClientRect(); if (e.clientY < b.top + b.height / 2) { to = i; break; } }
    setKids((prev) => {
      const from = prev.findIndex((k) => k.person.id === id);
      if (from === to) return prev;
      const next = [...prev]; const [it] = next.splice(from, 1); next.splice(to, 0, it); return next;
    });
  }

  const yearInput = (p: P) => (
    <input className="fa-year" aria-label={`${p.name}'s birth year`} inputMode="numeric" placeholder="Birth year" key={`${p.id}-${p.birthYear}`}
      defaultValue={p.birthYear ?? ""} onBlur={async (e) => {
        if (e.target.value.trim() === String(p.birthYear ?? "")) return;
        if (await run({ action: "birth", personId: p.id, value: e.target.value })) {
          const y = Number(e.target.value.trim().slice(0, 4)) || null;
          const next = sortByYear(kids.map((k) => (k.person.id === p.id ? { ...k, person: { ...k.person, birthYear: y } } : k)));
          if (kids.some((k) => k.person.id === p.id)) { setKids(next); saveKids(next); }
        }
      }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );

  const row = (kind: Kind, r: Row, extra?: React.ReactNode) => (
    <>
      <Face p={r.person} />
      <button type="button" className="fa-name" onClick={() => switchTo(r.person.id)} title={`Edit ${r.person.name}'s connections`}>{r.person.name}</button>
      {extra}
      <select className="fa-role" aria-label={`${r.person.name} is ${me.name}'s`} value={r.role}
        onChange={(e) => run({ action: "role", personId: me.id, otherId: r.person.id, role: e.target.value })}>
        {ROLE_SETS[kind].map((x) => <option key={x} value={x}>{cap(x)}</option>)}
      </select>
      <button type="button" className="fa-remove" onClick={() => remove(kind, r.person)}>Remove</button>
    </>
  );

  const parentAdd = data.parents.length >= 2 ? null
    : data.parents.length === 1 && data.parents[0].role === "mother" ? { label: `Add ${me.name}'s father (optional)`, role: "father" }
    : data.parents.length === 1 && data.parents[0].role === "father" ? { label: `Add ${me.name}'s mother (optional)`, role: "mother" }
    : data.parents.length === 1 ? { label: "Add a second parent (optional)", role: "parent" }
    : { label: "Add a parent", role: "parent" };
  const kind = kindOf(role);

  return (
    <div className="fa">
      <p className="crumbs"><Link href="/you">Settings</Link> / Admin / Family tree</p>
      <div className="page-head with-actions">
        <div>
          <h1 className="display">Family tree</h1>
          <p>Admin only. Pick a person to set their birth year and who they&apos;re connected to.</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/people" className="btn">View tree</Link>
          <Link href="/people/new" className="btn btn-primary">+ Add someone</Link>
        </div>
      </div>

      <div className="fa-editing">
        <span className="label">Editing</span>
        <PersonSelect current={me} everyone={everyone} onPick={switchTo} />
        <label className="fa-friend">
          <input type="checkbox" role="switch" className="switch" checked={me.friend}
            onChange={(e) => fetch(`/api/people/${me.id}/relations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "friend", on: e.target.checked }) }).then(() => router.refresh())} />
          Friend of the family
        </label>
        <label className="fa-friend" title="Had a child with someone in the family. Shown small on the tree beside the children they share, and left out of the family list and reminders.">
          <input type="checkbox" role="switch" className="switch" checked={me.coparent}
            onChange={(e) => fetch(`/api/people/${me.id}/relations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "coparent", on: e.target.checked }) }).then(() => router.refresh())} />
          Co-parent
        </label>
        <label className="fa-birth">
          <span className="label">Birth year</span>
          <input placeholder="Year or full date" key={`b${me.id}-${me.birthYear}`} defaultValue={me.birthYear ?? ""}
            onBlur={(e) => { if (e.target.value.trim() !== String(me.birthYear ?? "")) run({ action: "birth", personId: me.id, value: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="fa-layout">
        <div className="fa-cards">
          <section className="fa-card">
            <h2>Parents</h2>
            <ul>{data.parents.map((r) => <li key={r.person.id}>{row("parent", r)}</li>)}</ul>
            {parentAdd && <button type="button" className="fa-add" onClick={() => startAdd(parentAdd.role)}>+ <span>{parentAdd.label}</span></button>}
            {data.parents.length === 1 && <p className="hint">One parent is fine. With no second parent, {me.name} hangs straight from their parent on the tree.</p>}
          </section>

          <section className="fa-card">
            <div className="fa-card-head"><h2>Siblings</h2><span className="small muted">Anyone who shares a parent with {me.name}, oldest first</span></div>
            <ul>{data.siblings.map((r) => <li key={r.person.id}>{row("sibling", r, yearInput(r.person))}</li>)}</ul>
            <button type="button" className="fa-add" onClick={() => startAdd("sibling")}>+ <span>Add a sibling</span></button>
          </section>

          <section className="fa-card">
            <h2>Partners</h2>
            <ul>{data.partners.map((r) => <li key={r.person.id}>{row("partner", r)}</li>)}</ul>
            <button type="button" className="fa-add" onClick={() => startAdd("spouse")}>+ <span>Add a partner</span></button>
          </section>

          <section className="fa-card">
            <div className="fa-card-head"><h2>Children</h2><span className="small muted">Sorted by birth year. Drag to place anyone without a year.</span></div>
            <ul ref={kidList}>
              {kids.map((r, i) => (
                <li key={r.person.id} data-kid className={dragging === r.person.id ? "dragging" : undefined}>
                  <button type="button" className="hp-handle" aria-label={`Move ${r.person.name}. Use the arrow keys, or drag.`}
                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(r.person.id); }}
                    onPointerMove={(e) => onDragMove(e, r.person.id)}
                    onPointerUp={() => { setDragging(null); saveKids(kids); }}
                    onPointerCancel={() => setDragging(null)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                      e.preventDefault();
                      const to = i + (e.key === "ArrowUp" ? -1 : 1);
                      if (to < 0 || to >= kids.length) return;
                      const next = [...kids]; next.splice(to, 0, next.splice(i, 1)[0]); setKids(next); saveKids(next);
                    }}>
                    <Icon name="grip" size={16} />
                  </button>
                  {row("child", r, yearInput(r.person))}
                </li>
              ))}
            </ul>
            <button type="button" className="fa-add" onClick={() => startAdd("daughter")}>+ <span>Add a child</span></button>
          </section>
        </div>

        <aside className="fa-connect">
          <form onSubmit={add} className="fa-card">
            <h2>Add a connection</h2>
            <div ref={whoBox}>
              <TagPicker label="Who" options={everyone.filter((p) => p.id !== me.id).map(({ id, name, aliases }) => ({ id, name, aliases }))}
                value={who} onChange={(v) => setWho(v.slice(-1))} placeholder="Pick someone, or type a new name" />
            </div>
            <div className="field">
              <label htmlFor="fa-role">is {me.name}&apos;s</label>
              <select id="fa-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fa-birth">Birth year, if you know it</label>
              <input id="fa-birth" placeholder="Optional" value={birth} onChange={(e) => setBirth(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Adding" : "Add connection"}</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
