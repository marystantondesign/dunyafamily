"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { TagPicker, type Picked } from "./TagPicker";

type Tag = { id: Picked; removable: boolean };
type TagIn = { id: number; removable: boolean };
export type TagPhoto = {
  id: number; width: number | null; height: number | null; year: number | null; decade: number | null;
  owner: boolean; people: TagIn[]; occasions: TagIn[]; thumb: string; url: string; tagging_needed: boolean;
};
type PersonOption = { id: number; name: string; aliases: string[]; avatar_url: string | null };
type OccasionOption = { id: number; name: string };
type Draft = { people: Tag[]; occasions: Tag[]; year: number | null; decade: number | null; yearText: string; needed: boolean };

const SHORTCUTS = 9;
const DECADES = Array.from({ length: 10 }, (_, i) => 1930 + i * 10);
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1899 }, (_, i) => THIS_YEAR - i);
const OTHER = "__other";
const LOCKED = "Only the person who added this, or Mary, can remove it.";

const fromPhoto = (p: TagPhoto): Draft => ({
  people: p.people, occasions: p.occasions, year: p.year, decade: p.decade, yearText: p.year ? String(p.year) : "", needed: p.tagging_needed,
});
const key = (tags: Tag[]) => tags.map((t) => String(t.id)).sort().join(",");
const same = (a: Draft, b: Draft) => key(a.people) === key(b.people) && key(a.occasions) === key(b.occasions) && a.year === b.year && a.decade === b.decade && a.needed === b.needed;
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
          body: JSON.stringify({ people: d.people.map((t) => t.id), occasions: d.occasions.map((t) => t.id), year: d.year, decade: d.decade, taggingNeeded: d.needed }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
        const out = (await res.json()) as { people: (TagIn & { name: string })[]; occasions: (TagIn & { name: string })[]; year: number | null; decade: number | null; taggingNeeded: boolean };
        const next: Draft = {
          people: out.people.map(({ id, removable }) => ({ id, removable })),
          occasions: out.occasions.map(({ id, removable }) => ({ id, removable })),
          year: out.year, decade: out.decade, yearText: out.year ? String(out.year) : "", needed: out.taggingNeeded,
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
    <div className="tag-head">
      <div>
        <h1 className="display">Tag photos</h1>
        <p>Photo {Math.min(index + 1, total)} of {total} · <button type="button" className="link-btn" onClick={doneForNow}>Done for now</button></p>
      </div>
      {photo && (
        <div className="tag-actions">
          <button type="button" className="btn" onClick={() => go(index - 1)} disabled={index === 0}><Icon name="chevronLeft" size={18} /> Previous</button>
          <button type="button" className="btn" onClick={skip}>Skip</button>
          <button type="button" className="btn btn-primary" onClick={saveAndNext}>Save &amp; next <Icon name="arrowRight" size={18} /></button>
        </div>
      )}
    </div>
  );

  const filmstrip = (
    <div className="filmstrip-row">
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
  const extraPeople = draft.people.filter((t) => !shortcuts.some((p) => p.id === t.id));
  const extraOcc = draft.occasions.slice(1);

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
        {tag && <Icon name="check" size={16} stroke={2.2} />}
        <span className="chip-avatar" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {person?.avatar_url ? <img src={person.avatar_url} alt="" /> : name.slice(0, 1).toUpperCase()}
        </span>
        <span className="chip-name">{name}</span>
        {n !== undefined && <span className="sr-only">, shortcut {n}</span>}
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
            <h2 id="who" className="panel-title">Who&apos;s here?</h2>
            <div className="tag-search">
              <Icon name="search" size={18} />
              <TagPicker
                label="Search people, or add someone new"
                hideLabel
                options={knownPeople.filter((p) => !has(draft.people, p.id))}
                value={[]}
                onChange={(v) => addTyped("people", v[v.length - 1])}
                placeholder="Search people..."
              />
            </div>
            <div className="person-chips">
              {shortcuts.map((p, i) => personChip(p.id, i + 1))}
              {extraPeople.map((t) => personChip(t.id))}
            </div>
            {index > 0 && (
              <button type="button" className="link-btn plum" onClick={sameAsLast}>Same people as last photo</button>
            )}
            <label className="not-sure">
              <input type="checkbox" checked={draft.needed} onChange={(e) => edit((d) => ({ ...d, needed: e.target.checked }))} />
              <span>
                <strong>I&apos;m not sure who this is!</strong>
                <span>Checking the box marks this photo as &ldquo;<em>Tagging needed</em>&rdquo; so someone else can help.</span>
              </span>
            </label>
          </section>

          <div className="tag-fields">
            <div className="field">
              <label htmlFor="tag-when">Year <span className="opt">(optional)</span></label>
              <select
                id="tag-when"
                value={draft.year ? `y${draft.year}` : draft.decade ? `d${draft.decade}` : ""}
                disabled={yearLocked}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = Number(v.slice(1));
                  edit((x) => v.startsWith("y") ? { ...x, year: n, decade: Math.floor(n / 10) * 10, yearText: String(n) }
                    : v.startsWith("d") ? { ...x, year: null, decade: n, yearText: "" }
                    : { ...x, year: null, decade: null, yearText: "" });
                }}
              >
                <option value="">Not sure</option>
                <optgroup label="Sometime in the">
                  {DECADES.map((d) => <option key={d} value={`d${d}`} disabled={decadeLocked && d !== draft.decade}>{d}s</option>)}
                </optgroup>
                <optgroup label="Exact year">
                  {YEARS.map((y) => <option key={y} value={`y${y}`}>{y}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tag-occasion">Occasion <span className="opt">(optional)</span></label>
              <select
                id="tag-occasion"
                value={otherOpen ? OTHER : String(draft.occasions[0]?.id ?? "")}
                disabled={!!draft.occasions[0] && !draft.occasions[0].removable}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === OTHER) return setOtherOpen(true);
                  setOtherOpen(false);
                  const id = v ? Number(v) : null;
                  edit((x) => ({ ...x, occasions: [...(id ? [{ id, removable: true }] : []), ...x.occasions.slice(1).filter((t) => t.id !== id)] }));
                }}
              >
                <option value="">None</option>
                {knownOcc.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                {typeof draft.occasions[0]?.id === "string" && <option value={String(draft.occasions[0].id)}>{draft.occasions[0].id}</option>}
                <option value={OTHER}>Something else...</option>
              </select>
            </div>
          </div>
          {decadeLocked && <p className="hint">Only the person who added this photo, or Mary, can change its date.</p>}
          {otherOpen && (
            <TagPicker
              label="Name the occasion"
              options={knownOcc.filter((o) => !has(draft.occasions, o.id))}
              value={[]}
              onChange={(v) => { addTyped("occasions", v[v.length - 1]); setOtherOpen(false); }}
              placeholder="Graduation, a trip, a reunion"
            />
          )}
          {extraOcc.length > 0 && draft.occasions.length > 1 && (
            <div className="pills">
              {draft.occasions.slice(1).map((t) => (
                <button key={String(t.id)} type="button" className="pill on" aria-disabled={!t.removable || undefined} title={t.removable ? "Remove" : LOCKED} onClick={() => toggle("occasions", t.id)}>
                  {typeof t.id === "number" ? occNames.get(t.id) : t.id} {t.removable && <Icon name="x" size={14} />}
                </button>
              ))}
            </div>
          )}

          {message && <p className="error" role="alert">{message}</p>}
        </div>
      </div>

      {filmstrip}
      <p className="hint tag-keys">Keyboard: 1 to 9 toggle the first nine people · Enter saves and goes on · S skips · ← goes back</p>
    </div>
  );
}
