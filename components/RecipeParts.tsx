"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Ingredient, RecipeNote } from "@/lib/recipes";
import { uploadImage } from "@/lib/uploadImage";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { Face } from "./RecipeBox";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "That didn't work. Try again.");
  return data;
}

/** "2 years ago", "Yesterday", "3 weeks ago". */
function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) { const w = Math.floor(days / 7); return `${w} ${w === 1 ? "week" : "weeks"} ago`; }
  if (days < 365) { const m = Math.floor(days / 30); return `${m} ${m === 1 ? "month" : "months"} ago`; }
  const y = Math.floor(days / 365);
  return `${y} ${y === 1 ? "year" : "years"} ago`;
}

/** Ingredients (tick them off as you go; the ticks stay in this browser tab only) and the method. On phones a toggle shows one at a time. */
export function RecipeBody({ id, ingredients, steps }: { id: number; ingredients: Ingredient[]; steps: string[] }) {
  const [tab, setTab] = useState<"ingredients" | "method">("ingredients");
  const [ticked, setTicked] = useState<number[]>([]);
  const key = `df_recipe_ticks_${id}`;
  useEffect(() => {
    try { setTicked(JSON.parse(sessionStorage.getItem(key) ?? "[]")); } catch { /* private mode */ }
  }, [key]);
  function tick(i: number, on: boolean) {
    const next = on ? [...ticked, i] : ticked.filter((x) => x !== i);
    setTicked(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
  }
  return (
    <>
      <div className="rd-toggle phone-only" role="tablist" aria-label="Recipe sections">
        <button type="button" role="tab" aria-selected={tab === "ingredients"} onClick={() => setTab("ingredients")}>Ingredients</button>
        <button type="button" role="tab" aria-selected={tab === "method"} onClick={() => setTab("method")}>Method</button>
      </div>
      <div className={`rd-panels show-${tab}`}>
        <section className="rd-ingredients" aria-labelledby="rd-ing">
          <h2 id="rd-ing">Ingredients</h2>
          {ingredients.length ? (
            <ul>
              {ingredients.map((g, i) => (
                <li key={i}>
                  <label className={ticked.includes(i) ? "done" : ""}>
                    <input type="checkbox" checked={ticked.includes(i)} onChange={(e) => tick(i, e.target.checked)} />
                    <span className="rd-qty">{g.qty}</span>
                    <span className="rd-item">{g.item}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p className="muted">No ingredients written down.</p>}
        </section>
        <section className="rd-method" aria-labelledby="rd-met">
          <h2 id="rd-met">Method</h2>
          {steps.length ? (
            <ol>{steps.map((s, i) => <li key={i}><span className="rd-num">{i + 1}</span><span>{s}</span></li>)}</ol>
          ) : <p className="muted">No steps written down.</p>}
        </section>
      </div>
    </>
  );
}

/** Edit and Delete, for whoever added the recipe or the admin. */
export function RecipeMenu({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="rd-tools" ref={box}>
      <button type="button" className="icon-btn" aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="more" size={20} /></button>
      {open && (
        <>
          <div className="ss-backdrop phone-only" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="pv-menu rd-menu" role="menu">
            <div className="sheet-grip phone-only" aria-hidden="true" />
            <ul className="pv-menu-list">
              <li><Link role="menuitem" href={`/recipes/${id}/edit`}><Icon name="pencil" size={20} /> Edit recipe</Link></li>
              <li><button type="button" role="menuitem" className="danger" onClick={() => { setOpen(false); setRemoving(true); }}><Icon name="trash" size={20} /> Delete recipe</button></li>
            </ul>
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {removing && (
        <ConfirmDialog title={`Delete ${title}?`} body="It comes out of the recipe box for everyone, notes and all. Mary can bring it back from Recently deleted for 30 days."
          keep="Keep it" confirm="Delete recipe" onKeep={() => setRemoving(false)}
          onConfirm={async () => {
            setRemoving(false);
            try { await call(`/api/recipes/${id}`, "DELETE"); router.push("/recipes"); router.refresh(); } catch (e) { setError((e as Error).message); }
          }} />
      )}
    </div>
  );
}

/** Pick one photo: a dashed button, then a small preview with a way to take it off. */
export function PhotoPick({ file, onPick, label, big }: { file: File | null; onPick: (f: File | null) => void; label: string; big?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <>
      <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      {file ? (
        <div className={`photo-pick-chosen${big ? " big" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="" />}
          <button type="button" className="text-btn quiet" onClick={() => onPick(null)}>Remove photo</button>
        </div>
      ) : big ? (
        <button type="button" className="photo-pick big" onClick={() => input.current?.click()}><Icon name="photo" size={22} />{label}</button>
      ) : (
        <button type="button" className="photo-pick" aria-label={label} onClick={() => input.current?.click()}><Icon name="photo" size={20} /></button>
      )}
    </>
  );
}

/** Notes from the family: a box to add one, then everything so far, newest at the bottom. */
export function RecipeNotes({ recipeId, notes }: { recipeId: number; notes: RecipeNote[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<RecipeNote | null>(null);

  async function post() {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      const photoKey = file ? await uploadImage(file) : null;
      await call(`/api/recipes/${recipeId}/notes`, "POST", { text, photoKey });
      setText("");
      setFile(null);
      router.refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  return (
    <section className="rd-notes" aria-labelledby="rd-notes-h">
      <h2 id="rd-notes-h">Notes from the family</h2>
      <div className="rd-compose">
        <label htmlFor="rd-note" className="sr-only">Leave a note</label>
        <textarea id="rd-note" rows={2} placeholder="Made it? Changed something? Remember her making it?" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="rd-compose-bar">
          <PhotoPick file={file} onPick={setFile} label="Add a photo" />
          <button type="button" className="btn" disabled={busy || !text.trim()} onClick={post}>{busy ? "Posting" : "Post note"}</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      {notes.length > 0 && (
        <ul className="rd-note-list">
          {notes.map((n) => (
            <li key={n.id}>
              <Face from={{ name: n.author, avatarUrl: n.avatarUrl }} size={36} />
              <div className="rd-note-body">
                <div className="rd-note-head">
                  <span className="rd-note-who">{n.author}</span>
                  <time dateTime={n.createdAt} suppressHydrationWarning>{ago(n.createdAt)}</time>
                  {n.canDelete && <button type="button" className="link-btn rd-note-del" onClick={() => setRemoving(n)}>Delete</button>}
                </div>
                <p>{n.text}</p>
                {n.photoUrl && (
                  <a href={n.photoUrl} target="_blank" rel="noreferrer" className="rd-note-photo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={n.photoUrl} alt={`Photo ${n.author} added`} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <ConfirmDialog title="Delete this note?" body="It comes off the recipe for everyone. Mary can bring it back from Recently deleted for 30 days."
          keep="Keep it" confirm="Delete note" onKeep={() => setRemoving(null)}
          onConfirm={async () => {
            const id = removing.id;
            setRemoving(null);
            try { await call(`/api/recipe-notes/${id}`, "DELETE"); router.refresh(); } catch (e) { setError((e as Error).message); }
          }} />
      )}
    </section>
  );
}
