"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HomepageToggle } from "./HomepageToggle";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type Chip = { id: number; name: string; removable: boolean };
export type DetailsData = {
  photoId: number;
  title: string | null;
  /** What shows when there's no name, like "NYC, 2026". */
  fallback: string;
  addedBy: string;
  people: Chip[];
  occasions: Chip[];
  albums: Chip[];
  year: number | null;
  decade: number | null;
  canEditMeta: boolean;
  allPeople: Option[];
  allOccasions: Option[];
  allAlbums: Option[];
  homepage: { entry: { caption: string } | null; used: number } | null;
  /** Tagging needed: whether it's marked, and whether this visitor can take the mark off. */
  taggingNeeded: { on: boolean; canClear: boolean };
};

const DECADES = Array.from({ length: 11 }, (_, i) => 1930 + i * 10);

/**
 * Edit details (mockups 4 and 9). Each change saves as you go: names and dates when you leave the field,
 * people, occasions, and albums right away. Same permission rules as before.
 */
export function PhotoDetails({ d, onDone, tagHref, onRemove, avatarFor = [], onAvatar, helping, onThanks }: {
  d: DetailsData; onDone: () => void; tagHref: string; onRemove?: () => void;
  avatarFor?: { id: number; name: string }[]; onAvatar?: (p: { id: number; name: string }) => void;
  /** Opened from "Yes, I'll tag them": go straight to adding people. */
  helping?: boolean;
  /** After "Yes, that's everyone". */
  onThanks?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  // After someone tags a "Tagging needed" photo, ask once whether that's everyone.
  const [ask, setAsk] = useState<"no" | "open" | "done">("no");
  // The Tagging needed box changes at once, then follows what's saved.
  const [flagOn, setFlagOn] = useState(d.taggingNeeded.on);
  useEffect(() => setFlagOn(d.taggingNeeded.on), [d.taggingNeeded.on]);
  const who = useRef<HTMLDivElement>(null);
  useEffect(() => { if (helping) who.current?.querySelector("input")?.focus(); }, [helping]);
  const titleEditable = d.canEditMeta || !d.title;
  const yearEditable = d.canEditMeta || d.year === null;

  async function call(url: string, method: string, body: unknown) {
    setError("");
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    router.refresh();
  }
  const patch = (body: Record<string, unknown>) => call(`/api/photos/${d.photoId}`, "PATCH", body);
  const addTag = (kind: "person" | "occasion") => (v: Picked[]) => {
    const last = v[v.length - 1];
    if (last === undefined) return;
    call(`/api/photos/${d.photoId}/tags`, "POST", { kind, value: last });
    if (kind === "person" && flagOn && ask === "no") setAsk("open");
  };
  async function everyone() {
    setError("");
    const res = await fetch(`/api/photos/${d.photoId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taggingNeeded: false, everyone: true }) });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    setAsk("done");
    onThanks?.();
    router.refresh();
  }
  const removeTag = (kind: "person" | "occasion", id: number) => call(`/api/photos/${d.photoId}/tags`, "DELETE", { kind, value: id });
  const addAlbum = (v: Picked[]) => {
    const last = v[v.length - 1];
    if (typeof last === "number") call(`/api/albums/${last}/photos`, "POST", { photoIds: [d.photoId] });
    else if (last) call("/api/albums", "POST", { title: last, photoIds: [d.photoId] });
  };

  const chips = (list: Chip[], onRemove: (id: number) => void, what: string, avatars = false) => list.length > 0 && (
    <div className="pd-chips">
      {list.map((c) => {
        const canAvatar = avatars && onAvatar && avatarFor.some((p) => p.id === c.id);
        return (
          <span key={c.id} className="pd-chip-row">
            <span className="pd-chip">
              {c.name}
              {c.removable && <button type="button" aria-label={`Remove ${c.name} from ${what}`} onClick={() => onRemove(c.id)}>×</button>}
            </span>
            {canAvatar && <button type="button" className="pd-avatar" onClick={() => onAvatar({ id: c.id, name: c.name })}>Use as profile photo</button>}
          </span>
        );
      })}
    </div>
  );

  function done() {
    // Leaving the focused field saves it first.
    (document.activeElement as HTMLElement | null)?.blur();
    onDone();
  }

  return (
    <div className="pd">
      <div className="pd-head">
        <h2>Edit details</h2>
        <button type="button" className="btn btn-primary" onClick={done}>Done</button>
      </div>

      <div className="field pd-name">
        <label htmlFor="pd-title">Photo name</label>
        <input id="pd-title" className="pd-title" key={d.title ?? ""} defaultValue={d.title ?? ""} disabled={!titleEditable} placeholder={d.fallback}
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (d.title ?? "")) patch({ title: v }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <span className="hint">
          <span className="desktop-only">Leave blank to show the occasion and year{d.fallback ? `, like "${d.fallback}."` : "."}</span>
          <span className="phone-only">Leave blank to show the occasion and year.</span>
        </span>
        <span className="pd-added">{d.addedBy}</span>
      </div>

      <div className="pd-section" ref={who}>
        <span className="label">Who&apos;s here</span>
        {chips(d.people, (id) => removeTag("person", id), "this photo", true)}
        <TagPicker label="Add someone" hideLabel options={d.allPeople.filter((o) => !d.people.some((p) => p.id === o.id))} value={[]} onChange={addTag("person")} placeholder="Add someone" />
        {ask === "open" && (
          <div className="tn-ask" role="group" aria-label="Is that everyone?">
            <strong>Is that everyone?</strong>
            <div className="tn-ask-btns">
              <button type="button" className="btn btn-primary" onClick={everyone}>Yes, that&apos;s everyone</button>
              <button type="button" className="btn" onClick={() => setAsk("done")}>Still some I don&apos;t know</button>
            </div>
          </div>
        )}
        <label className="tn-check">
          <input type="checkbox" checked={flagOn} disabled={d.taggingNeeded.on && !d.taggingNeeded.canClear}
            onChange={(e) => { setFlagOn(e.target.checked); patch({ taggingNeeded: e.target.checked }); }} />
          <span><strong>Tagging needed</strong>
            <span className="hint">{d.taggingNeeded.on && !d.taggingNeeded.canClear
              ? "Only the person who marked this, or Mary, can take this off."
              : "There's someone here nobody has named yet."}</span>
          </span>
        </label>
      </div>

      <div className="pd-section">
        <span className="label">Occasion</span>
        {chips(d.occasions, (id) => removeTag("occasion", id), "this photo")}
        <TagPicker label="Add an occasion" hideLabel options={d.allOccasions.filter((o) => !d.occasions.some((x) => x.id === o.id))} value={[]} onChange={addTag("occasion")} placeholder="Add an occasion" />
      </div>

      <div className="pd-dates">
        <div className="field">
          <label htmlFor="pd-year">Year</label>
          <input id="pd-year" inputMode="numeric" key={`y${d.year}`} defaultValue={d.year ?? ""} placeholder="1994" disabled={!yearEditable}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v === String(d.year ?? "")) return;
              if (v && !/^\d{4}$/.test(v)) return setError("That year doesn't look right.");
              patch(v ? { year: Number(v) } : { year: null });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </div>
        <div className="field">
          <label htmlFor="pd-decade">Or decade</label>
          <select id="pd-decade" key={`d${d.decade}${d.year}`} defaultValue={d.year ? "" : d.decade ?? ""} disabled={!yearEditable || !!d.year}
            onChange={(e) => patch({ decade: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Choose</option>
            {DECADES.map((x) => <option key={x} value={x}>{x}s</option>)}
          </select>
        </div>
      </div>
      {!yearEditable && <p className="hint">Only the person who added this photo, or Mary, can change its date.</p>}

      <div className="pd-section">
        <span className="label">Albums</span>
        {chips(d.albums, (id) => call(`/api/albums/${id}/photos`, "DELETE", { photoIds: [d.photoId] }), "this album")}
        <TagPicker label="Add to an album" hideLabel options={d.allAlbums.filter((a) => !d.albums.some((x) => x.id === a.id))} value={[]} onChange={addAlbum} placeholder="Add to an album" />
      </div>

      {d.homepage && (
        <HomepageToggle key={`${d.homepage.entry ? 1 : 0}-${d.homepage.used}`} photoId={d.photoId} entry={d.homepage.entry} used={d.homepage.used} max={10} />
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <div className="pd-foot">
        <a href={tagHref}>Tag many in a row</a>
        <a href={`/api/photos/${d.photoId}/download`}>Download original</a>
        {onRemove && <button type="button" className="pd-remove" onClick={onRemove}>Delete photo</button>}
      </div>
    </div>
  );
}
