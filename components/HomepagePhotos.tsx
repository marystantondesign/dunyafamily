"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

type Item = { photoId: number; caption: string; url: string };
type Person = { id: number; name: string };
const MAX = 10;
const SPEEDS = [3, 4, 5, 6, 8, 10, 15];

async function send(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/homepage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? "That didn't save. Try again.");
  return out;
}

/** Homepage photos (admin): up to 10 photos for the Polaroid, with captions, order, and speed. Changes save right away. */
export function HomepagePhotos({ initial, seconds: startSeconds, people, dunya }: {
  initial: Item[]; seconds: number; people: Person[]; dunya: Person | null;
}) {
  const [items, setItems] = useState(initial);
  const [seconds, setSeconds] = useState(startSeconds);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  const saved = useRef(new Map(initial.map((i) => [i.photoId, i.caption])));
  const open = MAX - items.length;

  async function save(body: Record<string, unknown>) {
    setStatus("Saving");
    setError("");
    try { await send(body); setStatus("Saved"); } catch (e) { setError((e as Error).message); setStatus(""); }
  }

  const move = (id: number, to: number) => setItems((prev) => {
    const from = prev.findIndex((i) => i.photoId === id);
    if (from < 0 || to === from || to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
  });
  const saveOrder = (list: Item[]) => save({ action: "order", photoIds: list.map((i) => i.photoId) });

  // Drag by the handle with a mouse or a finger: the row moves to wherever the pointer is.
  function onPointerMove(e: React.PointerEvent, id: number) {
    if (dragging !== id || !list.current) return;
    const rows = [...list.current.querySelectorAll<HTMLElement>("[data-row]")];
    let to = rows.length - 1;
    for (const [i, row] of rows.entries()) {
      const r = row.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { to = i; break; }
    }
    move(id, to);
  }

  function captionDone(id: number, caption: string) {
    if (saved.current.get(id) === caption) return;
    saved.current.set(id, caption);
    save({ action: "caption", photoId: id, caption });
  }

  function remove(id: number) {
    setItems((prev) => prev.filter((i) => i.photoId !== id));
    save({ action: "remove", photoId: id });
  }

  const first = items[0];
  return (
    <>
    <div className="page-head with-actions">
      <div>
        <h1 className="display">Homepage photos</h1>
        <p>Up to 10 photos fade through the Polaroid on the homepage. Write what each one says, and drag to change the order.</p>
      </div>
      <button type="button" className="btn btn-primary desktop-only" onClick={() => setPicking(true)} disabled={!open}>+ Choose photos</button>
    </div>
    <div className="hp">
      <div className="hp-main">
        <div className="hp-card">
          <div className="hp-bar">
            <span>{items.length} of {MAX} spots used</span>
            <label className="hp-speed">
              <span className="desktop-only">Change every</span>
              <span className="phone-only">Every</span>
              <select value={seconds} onChange={(e) => { const s = Number(e.target.value); setSeconds(s); save({ action: "speed", seconds: s }); }}>
                {SPEEDS.map((s) => <option key={s} value={s}>{s} seconds</option>)}
              </select>
            </label>
          </div>
          <ol className="hp-list" ref={list}>
            {items.map((it, i) => (
              <li key={it.photoId} data-row className={dragging === it.photoId ? "dragging" : undefined}>
                <button type="button" className="hp-handle" aria-label={`Move photo ${i + 1}. Use the arrow keys, or drag.`}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(it.photoId); }}
                  onPointerMove={(e) => onPointerMove(e, it.photoId)}
                  onPointerUp={() => { setDragging(null); saveOrder(items); }}
                  onPointerCancel={() => setDragging(null)}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const to = i + (e.key === "ArrowUp" ? -1 : 1);
                    if (to < 0 || to >= items.length) return;
                    const next = [...items];
                    next.splice(to, 0, next.splice(i, 1)[0]);
                    setItems(next);
                    saveOrder(next);
                    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>(".hp-handle")[to]?.focus());
                  }}>
                  <Icon name="grip" size={18} />
                </button>
                <span className="hp-num desktop-only">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" className="hp-thumb" />
                <label className="hp-caption">
                  <span className="desktop-only">Caption</span>
                  <input value={it.caption} maxLength={60} placeholder="Write a caption" aria-label={`Caption for photo ${i + 1}`}
                    onChange={(e) => { const v = e.target.value; setItems((prev) => prev.map((x) => (x.photoId === it.photoId ? { ...x, caption: v } : x))); }}
                    onBlur={(e) => captionDone(it.photoId, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
                </label>
                <button type="button" className="hp-remove" onClick={() => remove(it.photoId)} aria-label={`Remove photo ${i + 1}`}>
                  <span className="desktop-only">Remove</span>
                  <Icon name="x" size={22} className="phone-only" />
                </button>
              </li>
            ))}
          </ol>
          {open > 0 && (
            <div className="hp-open desktop-only">
              <button type="button" className="hp-add" onClick={() => setPicking(true)} aria-label="Choose photos"><Icon name="plus" size={20} /></button>
              <span>{open} open {open === 1 ? "spot" : "spots"}. Choose photos, or turn on &quot;Show on the homepage&quot; from any photo&apos;s details.</span>
            </div>
          )}
          {!items.length && <p className="muted hp-empty">No photos yet, so the homepage shows a photo of Dunya.</p>}
        </div>
        <button type="button" className="btn btn-primary hp-choose phone-only" onClick={() => setPicking(true)} disabled={!open}>+ Choose photos</button>
        <p className="small muted phone-only">You can also turn on &quot;Show on the homepage&quot; from any photo&apos;s details.</p>
        <p className="hp-status small" role="status">{error ? <span className="error">{error}</span> : status}</p>
      </div>

      <aside className="hp-preview">
        <span className="label">Preview</span>
        <figure className="polaroid">
          <div className="polaroid-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {first ? <img src={first.url} alt="" /> : <div className="polaroid-blank" />}
          </div>
          <figcaption>{first?.caption ?? ""}</figcaption>
        </figure>
        <p className="small muted desktop-only">Shows photo 1. The homepage fades through all of them.</p>
      </aside>

      {picking && <Picker open={open} have={items.map((i) => i.photoId)} people={people} dunya={dunya} onClose={() => setPicking(false)} />}
    </div>
    </>
  );
}

/** Choose photos: photos of Dunya to start, or anyone, or every photo. */
function Picker({ open, have, people, dunya, onClose }: { open: number; have: number[]; people: Person[]; dunya: Person | null; onClose: () => void }) {
  const [person, setPerson] = useState<Person | null>(dunya);
  const [photos, setPhotos] = useState<{ id: number; url: string }[]>([]);
  const [more, setMore] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [filtering, setFiltering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);

  async function load(p: Person | null, offset = 0) {
    const res = await fetch(`/api/admin/homepage/photos?offset=${offset}${p ? `&person=${p.id}` : ""}`);
    const out = (await res.json()) as { photos: { id: number; url: string }[]; more: boolean };
    setPhotos((prev) => (offset ? [...prev, ...out.photos] : out.photos));
    setMore(out.more);
  }
  useEffect(() => { load(person); }, [person]);
  useEffect(() => { box.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, []);

  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < open ? [...p, id] : p));

  async function add() {
    setBusy(true);
    try { await send({ action: "add", photoIds: picked }); window.location.reload(); } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="hp-picker" ref={box} role="dialog" aria-label="Choose photos">
      <div className="hp-picker-head">
        <h2>Choose photos</h2>
        <span className="small muted">{picked.length} selected{picked.length >= open ? `, ${open} ${open === 1 ? "spot" : "spots"} open` : ""}</span>
      </div>
      <div className="hp-filters">
        {person ? (
          <button type="button" className="pill on" onClick={() => setPerson(null)}>Photos of {person.name} <span aria-hidden="true">×</span><span className="sr-only">, show every photo</span></button>
        ) : <span className="pill">All photos</span>}
        {filtering ? (
          <select autoFocus aria-label="Show photos of" value="" onChange={(e) => { const p = people.find((x) => x.id === Number(e.target.value)); setPerson(p ?? null); setFiltering(false); }} onBlur={() => setFiltering(false)}>
            <option value="">Choose a person</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : <button type="button" className="pill" onClick={() => setFiltering(true)}>+ Filter</button>}
      </div>
      <div className="hp-grid">
        {photos.map((p) => {
          const on = picked.includes(p.id), already = have.includes(p.id);
          return (
            <button key={p.id} type="button" className={`hp-pick${on ? " on" : ""}`} aria-pressed={on} disabled={already || (!on && picked.length >= open)}
              onClick={() => toggle(p.id)} aria-label={already ? "Already on the homepage" : on ? "Selected" : "Select this photo"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" />
              <span className="hp-dot" aria-hidden="true">{on && <Icon name="check" size={14} stroke={2.6} />}</span>
              {already && <span className="hp-already">On the homepage</span>}
            </button>
          );
        })}
      </div>
      {!photos.length && <p className="muted">{person ? `No photos of ${person.name} yet.` : "No photos yet."}</p>}
      {more && <button type="button" className="link-button small" onClick={() => load(person, photos.length)}>Show more</button>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="hp-picker-actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={!picked.length || busy} onClick={add}>
          {busy ? "Adding" : `Add ${picked.length || ""} ${picked.length === 1 ? "photo" : "photos"}`.replace("  ", " ")}
        </button>
      </div>
    </div>
  );
}
