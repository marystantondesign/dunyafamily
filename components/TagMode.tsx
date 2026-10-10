"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TagPicker, type Picked } from "./TagPicker";

type Tag = { id: Picked; removable: boolean };
type TagIn = { id: number; removable: boolean };
export type TagPhoto = {
  id: number; width: number | null; height: number | null; year: number | null; decade: number | null;
  owner: boolean; people: TagIn[]; occasions: TagIn[]; thumb: string; url: string;
};
type PersonOption = { id: number; name: string; aliases: string[]; avatar_url: string | null };
type OccasionOption = { id: number; name: string };
type Draft = { people: Tag[]; occasions: Tag[]; year: number | null; decade: number | null; yearText: string };

const SHORTCUTS = 9;
const OCCASION_CHIPS = 8;
const DECADES = Array.from({ length: 10 }, (_, i) => 1930 + i * 10);
const LOCKED = "Only the person who added this, or Mary, can remove it.";

const fromPhoto = (p: TagPhoto): Draft => ({
  people: p.people, occasions: p.occasions, year: p.year, decade: p.decade, yearText: p.year ? String(p.year) : "",
});
const key = (tags: Tag[]) => tags.map((t) => String(t.id)).sort().join(",");
const same = (a: Draft, b: Draft) => key(a.people) === key(b.people) && key(a.occasions) === key(b.occasions) && a.year === b.year && a.decade === b.decade;
const has = (tags: Tag[], id: Picked) => tags.some((t) => t.id === id);

function store(k: string, v: string | null) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private browsing */ }
}

export function TagMode({ photos, people, occasions, placeKey, startId, exitHref, capped }: {
  photos: TagPhoto[]; people: PersonOption[]; occasions: OccasionOption[];
  placeKey: string; startId?: number; exitHref: string; capped: boolean;
}) {
  const router = useRouter();
  const total = photos.length;
  const initial = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, fromPhoto(p)])) as Record<number, Draft>, [photos]);
  const [saved, setSaved] = useState(initial);
  const [drafts, setDrafts] = useState(initial);
  const [done, setDone] = useState(() => new Set(photos.filter((p) => p.people.length).map((p) => p.id)));
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [index, setIndex] = useState(0);
  const [knownPeople, setKnownPeople] = useState(people);
  const [knownOcc, setKnownOcc] = useState(occasions);
  const [otherOpen, setOtherOpen] = useState(false);
  const [message, setMessage] = useState("");
  const queue = useRef<Promise<void>>(Promise.resolve());
  const strip = useRef<HTMLDivElement>(null);

  // Pick up where this device left off, unless a specific photo was asked for.
  useEffect(() => {
    let id = startId;
    if (!id) try { id = Number(localStorage.getItem(placeKey)) || undefined; } catch { /* private browsing */ }
    const at = id ? photos.findIndex((p) => p.id === id) : -1;
    if (at > 0) setIndex(at);
  }, [photos, placeKey, startId]);

  const photo = photos[index] as TagPhoto | undefined;
  const draft = photo ? drafts[photo.id] : undefined;

  useEffect(() => {
    store(placeKey, photo ? String(photo.id) : null);
    setOtherOpen(false);
    setMessage("");
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    // Load the next two photos in the background so moving on feels instant.
    for (const p of photos.slice(index + 1, index + 3)) { new Image().src = p.thumb; new Image().src = p.url; }
  }, [index, photo, photos, placeKey]);

  const names = useMemo(() => new Map(knownPeople.map((p) => [p.id, p])), [knownPeople]);
  const occNames = useMemo(() => new Map(knownOcc.map((o) => [o.id, o.name])), [knownOcc]);
  const shortcuts = knownPeople.slice(0, SHORTCUTS);

  const edit = (fn: (d: Draft) => Draft) => photo && setDrafts((all) => ({ ...all, [photo.id]: fn(all[photo.id]) }));

  function toggle(list: "people" | "occasions", id: Picked) {
    if (!draft) return;
    const current = draft[list].find((t) => t.id === id);
    if (current && !current.removable) return setMessage(LOCKED);
    setMessage("");
    edit((d) => ({ ...d, [list]: current ? d[list].filter((t) => t.id !== id) : [...d[list], { id, removable: true }] }));
  }

  /** Typed names that match someone already in the family become that person instead of a duplicate. */
  function addTyped(list: "people" | "occasions", v: Picked) {
    if (v === undefined || !draft) return;
    let id = v;
    if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      const match = list === "people"
        ? knownPeople.find((p) => [p.name, ...p.aliases].some((n) => n.toLowerCase() === t))?.id
        : knownOcc.find((o) => o.name.toLowerCase() === t)?.id;
      id = match ?? v.trim();
    }
    if (!has(draft[list], id)) toggle(list, id);
  }

  function sameAsLast() {
    if (!photo || index === 0) return;
    const prev = drafts[photos[index - 1].id].people;
    edit((d) => {
      const locked = d.people.filter((t) => !t.removable);
      const rest = prev.filter((t) => !has(locked, t.id)).map((t) => ({ id: t.id, removable: d.people.find((x) => x.id === t.id)?.removable ?? true }));
      return { ...d, people: [...locked, ...rest] };
    });
  }

  const save = useCallback((id: number, d: Draft) => {
    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch(`/api/photos/${id}/tagging`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ people: d.people.map((t) => t.id), occasions: d.occasions.map((t) => t.id), year: d.year, decade: d.decade }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
        const out = (await res.json()) as { people: (TagIn & { name: string })[]; occasions: (TagIn & { name: string })[]; year: number | null; decade: number | null };
        const next: Draft = {
          people: out.people.map(({ id, removable }) => ({ id, removable })),
          occasions: out.occasions.map(({ id, removable }) => ({ id, removable })),
          year: out.year, decade: out.decade, yearText: out.year ? String(out.year) : "",
        };
        setKnownPeople((list) => [...list, ...out.people.filter((p) => !list.some((x) => x.id === p.id)).map((p) => ({ id: p.id, name: p.name, aliases: [], avatar_url: null }))]);
        setKnownOcc((list) => [...list, ...out.occasions.filter((o) => !list.some((x) => x.id === o.id)).map((o) => ({ id: o.id, name: o.name }))]);
        setSaved((all) => ({ ...all, [id]: next }));
        // Only replace the draft if nobody has changed it again since this save started.
        setDrafts((all) => (all[id] === d ? { ...all, [id]: next } : all));
        setFailed((s) => { const n = new Set(s); n.delete(id); return n; });
      } catch (e) {
        setFailed((s) => new Set(s).add(id));
        setMessage(e instanceof Error && e.message ? e.message : "A photo didn't save. It's marked in red below. Open it to try again.");
      }
    });
  }, []);

  /** Reads the year box and saves anything that changed. Returns false if the year needs fixing first. */
  function flush(markDone: boolean) {
    if (!photo || !draft) return true;
    let d = draft;
    const text = draft.yearText.trim();
    if (text !== (draft.year ? String(draft.year) : "")) {
      const y = text ? Number(text) : null;
      if (y !== null && (!Number.isInteger(y) || y < 1850 || y > new Date().getFullYear())) {
        setMessage("That year doesn't look right.");
        return false;
      }
      d = { ...draft, year: y, decade: y ? Math.floor(y / 10) * 10 : null };
      setDrafts((all) => ({ ...all, [photo.id]: d }));
    }
    if (!same(d, saved[photo.id]) || failed.has(photo.id)) save(photo.id, d);
    if (markDone || d.people.length) setDone((s) => new Set(s).add(photo.id));
    return true;
  }

  const go = (to: number) => { if (to >= 0 && to <= total && flush(false)) setIndex(to); };
  const saveAndNext = () => { if (flush(true)) setIndex((i) => Math.min(i + 1, total)); };
  const skip = () => {
    if (!photo) return;
    setDrafts((all) => ({ ...all, [photo.id]: saved[photo.id] }));
    setIndex((i) => Math.min(i + 1, total));
  };
  const doneForNow = () => { if (flush(false)) router.push(exitHref); };

  // Keyboard: 1 to 9 toggle people, Enter saves and goes on, S skips, left arrow goes back.
  const keys = useRef({ toggle, saveAndNext, skip, go, index, shortcuts });
  keys.current = { toggle, saveAndNext, skip, go, index, shortcuts };
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      const t = e.target as HTMLElement;
      const k = keys.current;
      if (t.closest("input, textarea, select")) {
        if (e.key === "Enter" && t.id === "tag-year") { e.preventDefault(); k.saveAndNext(); }
        return;
      }
      if (t.closest("a")) return;
      // Enter on Skip, Back, or a filmstrip photo presses that button. On a person or occasion chip it saves.
      if (e.key === "Enter" && t.closest("button") && !t.closest(".person-chip, .pill")) return;
      if (e.key === "Enter") { e.preventDefault(); k.saveAndNext(); }
      else if (e.key === "s" || e.key === "S") { e.preventDefault(); k.skip(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); k.go(k.index - 1); }
      else if (/^[1-9]$/.test(e.key)) {
        const p = k.shortcuts[Number(e.key) - 1];
        if (p) { e.preventDefault(); k.toggle("people", p.id); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!total) {
    return (
      <div className="tag-mode tag-empty">
        <h1 className="display">Nothing to tag here</h1>
        <p className="muted">Every photo in this view already has tags, or there are no photos yet.</p>
        <div className="actions"><Link className="btn btn-primary" href="/">Go home</Link><Link className="btn" href="/browse">Browse</Link></div>
      </div>
    );
  }

  const header = (
    <div className="tag-top">
      <Link href="/" className="brand">Dunya Family</Link>
      <div className="tag-status">
        <span className="muted tag-label">Tagging photos</span>
        <strong>{Math.min(index + 1, total)} of {total}</strong>
        <button className="btn" onClick={doneForNow}>Done for now</button>
      </div>
    </div>
  );

  const filmstrip = (
    <div className="filmstrip-row">
      <button className="link-btn" onClick={() => go(index - 1)} disabled={index === 0}>← Back</button>
      <div className="filmstrip" ref={strip}>
        {photos.map((p, i) => (
          <button
            key={p.id}
            aria-current={i === index}
            aria-label={`Photo ${i + 1}${done.has(p.id) ? ", tagged" : ""}${failed.has(p.id) ? ", didn't save" : ""}`}
            className={`${done.has(p.id) ? "done" : ""}${failed.has(p.id) ? " failed" : ""}`}
            onClick={() => go(i)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );

  if (!photo || !draft) {
    return (
      <div className="tag-mode">
        {header}
        <div className="tag-empty">
          <h1 className="display">That&apos;s all {total} {total === 1 ? "photo" : "photos"}</h1>
          <p className="muted">
            {done.size} tagged.{failed.size > 0 && ` ${failed.size} didn't save. They're marked in red below.`}
            {capped && " This view had more photos than fit in one session. Start again to keep going."}
          </p>
          <div className="actions">
            <Link className="btn btn-primary" href="/">Go home</Link>
            <Link className="btn" href={exitHref === "/" ? "/browse" : exitHref}>Browse</Link>
          </div>
        </div>
        {filmstrip}
      </div>
    );
  }

  const yearLocked = !photo.owner && saved[photo.id].year !== null;
  const decadeLocked = yearLocked || (!photo.owner && saved[photo.id].decade !== null);
  const shownDecade = draft.yearText.trim() && Number(draft.yearText) > 1800 ? Math.floor(Number(draft.yearText) / 10) * 10 : draft.decade;
  const extraPeople = draft.people.filter((t) => !shortcuts.some((p) => p.id === t.id));
  const occChips = knownOcc.slice(0, OCCASION_CHIPS);
  const extraOcc = draft.occasions.filter((t) => !occChips.some((o) => o.id === t.id));

  const personChip = (id: Picked, n?: number) => {
    const tag = draft.people.find((t) => t.id === id);
    const person = typeof id === "number" ? names.get(id) : undefined;
    const name = person?.name ?? String(id);
    return (
      <button
        key={String(id)}
        type="button"
        className={`person-chip${tag ? " on" : ""}`}
        aria-pressed={!!tag}
        aria-disabled={tag && !tag.removable ? true : undefined}
        title={tag && !tag.removable ? LOCKED : undefined}
        onClick={() => toggle("people", id)}
      >
        <span className="chip-avatar" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {person?.avatar_url ? <img src={person.avatar_url} alt="" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <span className="chip-name">{name}</span>
        {n !== undefined && <kbd>{n}</kbd>}
      </button>
    );
  };

  return (
    <div className="tag-mode">
      {header}
      <div className="tag-layout">
        <div className="tag-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.thumb} alt="" />
          {/* The full photo fades in over the thumbnail once it has loaded. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={photo.id} src={photo.url} alt="Photo being tagged" className="full" onLoad={(e) => e.currentTarget.classList.add("loaded")} onError={(e) => e.currentTarget.classList.add("broken")} />
        </div>

        <div className="tag-panel">
          <section aria-labelledby="who">
            <h2 id="who" className="label">Who&apos;s here</h2>
            <div className="person-chips">
              {shortcuts.map((p, i) => personChip(p.id, i + 1))}
              {extraPeople.map((t) => personChip(t.id))}
            </div>
            <TagPicker
              label="Someone else or someone new"
              hideLabel
              options={knownPeople.filter((p) => !has(draft.people, p.id))}
              value={[]}
              onChange={(v) => addTyped("people", v[v.length - 1])}
              placeholder="Someone else or someone new"
            />
            {index > 0 && (
              <button type="button" className="link-btn plum" onClick={sameAsLast}>Same people as last photo</button>
            )}
          </section>

          <section aria-labelledby="when">
            <h2 id="when" className="label">When</h2>
            <div className="pills">
              {DECADES.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`pill${shownDecade === d ? " on" : ""}`}
                  aria-pressed={shownDecade === d}
                  disabled={decadeLocked}
                  onClick={() => edit((x) => ({ ...x, year: null, yearText: "", decade: x.decade === d && !x.yearText.trim() ? null : d }))}
                >
                  {d}s
                </button>
              ))}
            </div>
            <div className="field tag-year">
              <label htmlFor="tag-year" className="sr-only">Exact year</label>
              <input
                id="tag-year"
                inputMode="numeric"
                placeholder="Exact year"
                value={draft.yearText}
                disabled={yearLocked}
                onChange={(e) => edit((x) => ({ ...x, yearText: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              />
            </div>
            {decadeLocked && <p className="hint">Only the person who added this photo, or Mary, can change its date.</p>}
          </section>

          <section aria-labelledby="occasion">
            <h2 id="occasion" className="label">Occasion</h2>
            <div className="pills">
              {[...occChips.map((o) => o.id), ...extraOcc.map((t) => t.id)].map((id) => {
                const tag = draft.occasions.find((t) => t.id === id);
                return (
                  <button
                    key={String(id)}
                    type="button"
                    className={`pill${tag ? " on" : ""}`}
                    aria-pressed={!!tag}
                    aria-disabled={tag && !tag.removable ? true : undefined}
                    title={tag && !tag.removable ? LOCKED : undefined}
                    onClick={() => toggle("occasions", id)}
                  >
                    {typeof id === "number" ? occNames.get(id) : id}
                  </button>
                );
              })}
              {!otherOpen && <button type="button" className="pill" onClick={() => setOtherOpen(true)}>+ Other</button>}
            </div>
            {otherOpen && (
              <TagPicker
                label="Other occasion"
                hideLabel
                options={knownOcc.filter((o) => !has(draft.occasions, o.id))}
                value={[]}
                onChange={(v) => addTyped("occasions", v[v.length - 1])}
                placeholder="Graduation, Easter, a trip"
              />
            )}
          </section>

          {message && <p className="error" role="alert">{message}</p>}

          <div className="tag-actions">
            <button type="button" className="btn" onClick={skip}>Skip <kbd>S</kbd></button>
            <button type="button" className="btn btn-primary" onClick={saveAndNext}>Save and next <kbd>Enter</kbd></button>
          </div>
        </div>
      </div>

      {filmstrip}
      <p className="hint tag-keys">Keyboard: 1 to 9 toggles people · Enter saves and goes to the next photo · S skips · ← goes back</p>
    </div>
  );
}
