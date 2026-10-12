"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Ingredient } from "@/lib/recipes";
import { uploadImage } from "@/lib/uploadImage";
import { Icon } from "./Icon";
import { PhotoPick } from "./RecipeParts";

type Person = { id: number; name: string };
export type RecipeDraft = {
  title: string; personId: number | null; fromName: string; intro: string; servings: string;
  ingredients: Ingredient[]; steps: string[]; cardPhotoKey: string | null; cardPhotoUrl?: string | null;
};
const EMPTY: RecipeDraft = { title: "", personId: null, fromName: "", intro: "", servings: "", ingredients: [{ qty: "", item: "" }], steps: [""], cardPhotoKey: null };
const SOMEONE_ELSE = "else";

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "That didn't work. Try again.");
  return data;
}

/** A textarea that grows with what's in it. */
function Grow(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

/** Step 2, "Check it over": every field stays editable. Nothing is saved until Save recipe. */
function CheckItOver({ people, draft, set, hint, onSave, saving, error, cancelHref, numbered }: {
  people: Person[]; draft: RecipeDraft; set: (d: RecipeDraft) => void; hint: string; onSave: () => void; saving: boolean; error: string; cancelHref: string; numbered: boolean;
}) {
  const [elsewise, setElsewise] = useState(!draft.personId && !!draft.fromName);
  const who = draft.personId ? String(draft.personId) : elsewise ? SOMEONE_ELSE : "";
  const setIng = (i: number, patch: Partial<Ingredient>) => set({ ...draft, ingredients: draft.ingredients.map((g, k) => (k === i ? { ...g, ...patch } : g)) });
  const setStep = (i: number, v: string) => set({ ...draft, steps: draft.steps.map((x, k) => (k === i ? v : x)) });
  useEffect(() => { if (draft.personId) setElsewise(false); }, [draft.personId]);

  return (
    <section className="ra-check" aria-labelledby="ra-check-h">
      <h2 id="ra-check-h">{numbered ? "2. Check it over" : "Check it over"}</h2>
      <p className="ra-sub">Fix anything that came out wrong. Nothing saves until you say so.</p>
      <div className="ra-field">
        <label htmlFor="ra-name">Name</label>
        <input id="ra-name" value={draft.title} onChange={(e) => set({ ...draft, title: e.target.value })} />
      </div>
      <div className="ra-field">
        <label htmlFor="ra-who">Whose recipe</label>
        <select id="ra-who" value={who} onChange={(e) => {
          const v = e.target.value;
          if (v === SOMEONE_ELSE) { setElsewise(true); set({ ...draft, personId: null }); }
          else { setElsewise(false); set({ ...draft, personId: v ? Number(v) : null, fromName: "" }); }
        }}>
          <option value="">Choose</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value={SOMEONE_ELSE}>Someone else</option>
        </select>
        {who === SOMEONE_ELSE && (
          <input aria-label="Their name" placeholder="Their name" value={draft.fromName} onChange={(e) => set({ ...draft, fromName: e.target.value })} />
        )}
        {hint && !draft.personId && who !== SOMEONE_ELSE && <p className="hint">The recipe says it&apos;s from &ldquo;{hint}&rdquo;.</p>}
      </div>
      <div className="ra-field">
        <span className="ra-label" id="ra-ing">Ingredients</span>
        <ul className="ra-ings" aria-labelledby="ra-ing">
          {draft.ingredients.map((g, i) => (
            <li key={i}>
              <input className="ra-qty" aria-label={`Amount, ingredient ${i + 1}`} placeholder="Amount" value={g.qty} onChange={(e) => setIng(i, { qty: e.target.value })} />
              <input className="ra-item" aria-label={`Ingredient ${i + 1}`} placeholder="Ingredient" value={g.item} onChange={(e) => setIng(i, { item: e.target.value })} />
              <button type="button" className="icon-btn ra-x" aria-label={`Remove ingredient ${i + 1}`} onClick={() => set({ ...draft, ingredients: draft.ingredients.filter((_, k) => k !== i) })}><Icon name="x" size={16} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="text-btn ra-more" onClick={() => set({ ...draft, ingredients: [...draft.ingredients, { qty: "", item: "" }] })}>
          <Icon name="plus" size={14} stroke={2} /> Add an ingredient
        </button>
      </div>
      <div className="ra-field">
        <span className="ra-label" id="ra-steps">Steps</span>
        <ol className="ra-steps" aria-labelledby="ra-steps">
          {draft.steps.map((x, i) => (
            <li key={i}>
              <span className="ra-n" aria-hidden="true">{i + 1}.</span>
              <Grow aria-label={`Step ${i + 1}`} value={x} onChange={(e) => setStep(i, e.target.value)} />
              <button type="button" className="icon-btn ra-x" aria-label={`Remove step ${i + 1}`} onClick={() => set({ ...draft, steps: draft.steps.filter((_, k) => k !== i) })}><Icon name="x" size={16} /></button>
            </li>
          ))}
        </ol>
        <button type="button" className="text-btn ra-more" onClick={() => set({ ...draft, steps: [...draft.steps, ""] })}>
          <Icon name="plus" size={14} stroke={2} /> Add a step
        </button>
      </div>
      <div className="ra-field">
        <label htmlFor="ra-serves">Serves <span className="ra-opt">(optional)</span></label>
        <input id="ra-serves" placeholder="Serves about 6" value={draft.servings} onChange={(e) => set({ ...draft, servings: e.target.value })} />
      </div>
      <div className="ra-field">
        <label htmlFor="ra-intro">A line about it <span className="ra-opt">(optional)</span></label>
        <input id="ra-intro" placeholder="Every Sunday in winter." value={draft.intro} onChange={(e) => set({ ...draft, intro: e.target.value })} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="ra-actions">
        <Link href={cancelHref} className="btn">Cancel</Link>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={onSave}>{saving ? "Saving" : "Save recipe"}</button>
      </div>
    </section>
  );
}

/** The card photo: uploads as soon as it's picked, so sorting and saving can use it. */
function useCardPhoto(initialKey: string | null) {
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState<string | null>(initialKey);
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const pending = useRef<Promise<string | null> | null>(null);
  function pick(f: File | null) {
    setFile(f);
    if (!f) { setKey(null); setState("idle"); pending.current = null; return; }
    setState("uploading");
    const p = uploadImage(f).then((k) => { setKey(k); setState("idle"); return k; }, () => { setState("error"); return null; });
    pending.current = p;
  }
  /** The key once any upload in progress finishes. */
  const ready = async () => (pending.current ? await pending.current : key);
  return { file, key, state, pick, ready };
}

/** Add a recipe: paste it in, sort it out, check it over, save. */
export function AddRecipe({ people }: { people: Person[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<RecipeDraft>(EMPTY);
  const [hint, setHint] = useState("");
  const [sorting, setSorting] = useState(false);
  const [sortMsg, setSortMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photo = useCardPhoto(null);
  const check = useRef<HTMLDivElement>(null);

  async function sort() {
    setSorting(true);
    setSortMsg("");
    try {
      const photoKey = text.trim() ? null : await photo.ready();
      const r = (await call("/api/recipes/parse", "POST", { text, photoKey })) as { title: string; servings: string; from_hint: string; ingredients: Ingredient[]; steps: string[] };
      const match = r.from_hint ? people.find((p) => p.name.toLowerCase() === r.from_hint.toLowerCase() || p.name.split(" ")[0].toLowerCase() === r.from_hint.toLowerCase()) : undefined;
      setHint(match ? "" : r.from_hint);
      setDraft({
        ...draft,
        title: r.title || draft.title,
        servings: r.servings || draft.servings,
        personId: match?.id ?? draft.personId,
        ingredients: r.ingredients.length ? r.ingredients : draft.ingredients,
        steps: r.steps.length ? r.steps : draft.steps,
      });
      if (window.matchMedia("(max-width: 760px)").matches) check.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { setSortMsg((e as Error).message); }
    setSorting(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (photo.state === "error") throw new Error("The card photo didn't upload. Remove it or try it again.");
      const cardPhotoKey = await photo.ready();
      const { id } = await call("/api/recipes", "POST", { ...draft, cardPhotoKey });
      router.push(`/recipes/${id}`);
      router.refresh();
    } catch (e) { setError((e as Error).message); setSaving(false); }
  }

  return (
    <div className="ra-grid">
      <section className="ra-paste" aria-labelledby="ra-paste-h">
        <h2 id="ra-paste-h">1. Paste it in, however it&apos;s written</h2>
        <label htmlFor="ra-text" className="sr-only">Recipe text</label>
        <textarea id="ra-text" rows={13} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="ra-photo">
          <span className="ra-label">Photo of the original card <span className="ra-opt">(optional)</span></span>
          <PhotoPick file={photo.file} onPick={photo.pick} label="Add a photo of the card" big />
          {photo.state === "uploading" && <p className="hint">Uploading the photo</p>}
          {photo.state === "error" && <p className="error" role="alert">The photo didn&apos;t upload. Remove it and try again.</p>}
        </div>
        <button type="button" className="btn btn-primary ra-sort" disabled={sorting || (!text.trim() && !photo.file)} onClick={sort}>
          {sorting ? "Sorting it out" : "Sort it out for me"}
        </button>
        {sortMsg && <p className="error" role="alert">{sortMsg}</p>}
      </section>
      <div ref={check}>
        <CheckItOver people={people} draft={draft} set={setDraft} hint={hint} onSave={save} saving={saving} error={error} cancelHref="/recipes" numbered />
      </div>
    </div>
  );
}

/** Edit a recipe that's already in the box. */
export function EditRecipe({ id, people, initial }: { id: number; people: Person[]; initial: RecipeDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RecipeDraft>({
    ...initial,
    ingredients: initial.ingredients.length ? initial.ingredients : [{ qty: "", item: "" }],
    steps: initial.steps.length ? initial.steps : [""],
  });
  const [keepPhoto, setKeepPhoto] = useState(!!initial.cardPhotoKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photo = useCardPhoto(null);

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (photo.state === "error") throw new Error("The card photo didn't upload. Remove it or try it again.");
      const fresh = await photo.ready();
      const cardPhotoKey = fresh ?? (keepPhoto ? initial.cardPhotoKey : null);
      await call(`/api/recipes/${id}`, "PATCH", { ...draft, cardPhotoKey });
      router.push(`/recipes/${id}`);
      router.refresh();
    } catch (e) { setError((e as Error).message); setSaving(false); }
  }

  return (
    <div className="ra-grid">
      <section className="ra-paste" aria-labelledby="ra-photo-h">
        <h2 id="ra-photo-h">Photo of the original card</h2>
        {keepPhoto && initial.cardPhotoUrl && !photo.file ? (
          <div className="photo-pick-chosen big">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initial.cardPhotoUrl} alt="" />
            <button type="button" className="text-btn quiet" onClick={() => setKeepPhoto(false)}>Remove photo</button>
          </div>
        ) : (
          <PhotoPick file={photo.file} onPick={photo.pick} label="Add a photo of the card" big />
        )}
        {photo.state === "uploading" && <p className="hint">Uploading the photo</p>}
        {photo.state === "error" && <p className="error" role="alert">The photo didn&apos;t upload. Remove it and try again.</p>}
      </section>
      <CheckItOver people={people} draft={draft} set={setDraft} hint="" onSave={save} saving={saving} error={error} cancelHref={`/recipes/${id}`} numbered={false} />
    </div>
  );
}
