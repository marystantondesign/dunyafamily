"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlbumAdd, type AlbumOption } from "./AlbumPicker";
import { SortSelect } from "./BrowseFilters";
import { Gallery } from "./Gallery";
import { Icon } from "./Icon";
import { SlideshowStart } from "./SlideshowStart";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type BrowsePhoto = { id: number; url: string; width: number | null; height: number | null; year: number | null; decade: number | null; month: number | null; removable: boolean };
type Panel = "date" | "occasion" | "person" | "album" | null;
const SORT_WORD: Record<string, string> = { shuffled: ", shuffled", newest: ", newest first", oldest: ", oldest first", favorited: ", newest favorited first" };

/** The browse gallery, plus select mode: check photos, then change them all at once. */
export function BrowseResults({ photos, query, people, occasions, albums, inAlbum, total, sort }: {
  photos: BrowsePhoto[]; query: string; people: Option[]; occasions: Option[];
  total: number;
  /** Browse only: the sort control, count, and slideshow. Album pages leave it out. */
  sort?: { value: string; fallback: string; params: Record<string, string>; filtered: boolean; favorites?: boolean; tagging?: boolean };
  albums: AlbumOption[];
  /** On an album page: select mode can also take photos out of this album. */
  inAlbum?: { id: number; title: string };
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [year, setYear] = useState("");
  const [decade, setDecade] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const removable = photos.filter((p) => selected.includes(p.id) && p.removable).length;
  const stop = () => { setSelecting(false); setSelected([]); setPanel(null); setError(""); };

  async function run(body: Record<string, unknown>, url = "/api/photos/bulk", method = "POST") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, photoIds: selected, ...body }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error);
      setMessage(out.message);
      setSelected([]); setPanel(null); setYear(""); setDecade("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function applyDate(e: React.FormEvent) {
    e.preventDefault();
    const y = year.trim() ? Number(year) : null;
    if (y !== null && (!Number.isInteger(y) || y < 1850 || y > new Date().getFullYear())) return setError("That year doesn't look right.");
    if (!y && !decade) return setError("Add a year or choose a decade.");
    run({ action: "date", year: y, decade: y ? null : Number(decade) });
  }

  function remove() {
    const others = selected.length - removable;
    const text = `Remove ${removable} ${removable === 1 ? "photo" : "photos"} from the site?${others ? ` ${others} added by someone else will stay.` : ""} Mary can restore anything removed by mistake.`;
    if (confirm(text)) run({ action: "remove" });
  }

  const addToAlbum = (p: { albumId: number } | { newTitle: string }) =>
    "albumId" in p ? run({}, `/api/albums/${p.albumId}/photos`) : run({ title: p.newTitle }, "/api/albums").then(() => undefined);
  function takeOut() {
    if (inAlbum && confirm(`Take ${selected.length === 1 ? "this photo" : `these ${selected.length} photos`} out of ${inAlbum.title}? They stay on the site.`))
      run({}, `/api/albums/${inAlbum.id}/photos`, "DELETE");
  }

  const pick = (action: "person" | "occasion") => (v: Picked[]) => { const last = v[v.length - 1]; if (last !== undefined) run({ action, value: last }); };

  return (
    <>
      <div className="browse-tools">
        <span className={`browse-count${sort?.favorites || sort?.tagging ? " fav-count" : ""}`}>
          {sort?.tagging ? (
            <>
              <span className="desktop-only">{total} {total === 1 ? "photo needs" : "photos need"} tagging. Know someone? Open the photo and tag them.</span>
              <span className="phone-only">{total} {total === 1 ? "photo needs" : "photos need"} tagging</span>
            </>
          ) : sort?.favorites ? (
            <>
              <span className="desktop-only">{total} {total === 1 ? "favorite" : "favorites"}{SORT_WORD[sort.value] ?? ""}. Only you see this list.</span>
              <span className="phone-only">{total} {total === 1 ? "favorite" : "favorites"}. Only you see these.</span>
            </>
          ) : <>{total} {total === 1 ? "photo" : "photos"}{sort?.value === "shuffled" ? ", shuffled" : ""}</>}
          {sort?.value === "shuffled" && (
            <button type="button" className={`icon-btn shuffle-btn${sort.favorites || sort.tagging ? " desktop-only" : ""}`} aria-label="Shuffle again" title="Shuffle again" onClick={() => {
              document.cookie = `df_shuffle=${Math.random().toString(36).slice(2, 10)}; path=/; samesite=lax`;
              const qs = new URLSearchParams(sort.params); qs.delete("page");
              router.push(`${window.location.pathname}${qs.size ? `?${qs}` : ""}`, { scroll: false });
              router.refresh();
            }}><Icon name="shuffle" size={18} /></button>
          )}
        </span>
        <span className="browse-actions">
          {sort && <SortSelect value={sort.value} fallback={sort.fallback} params={sort.params} favorites={sort.favorites} />}
          {selecting
            ? <button type="button" className="btn btn-dark-outline" onClick={stop}>Done selecting</button>
            : <button type="button" className="btn select-btn" onClick={() => { setSelecting(true); setMessage(""); }}>Select</button>}
          {selecting && (selected.length < photos.length
            ? <button type="button" className="btn" onClick={() => { setSelected(photos.map((p) => p.id)); setMessage(""); }}>Select all {photos.length}</button>
            : <button type="button" className="btn" onClick={() => setSelected([])}>Unselect all</button>)}
          {!selecting && <SlideshowStart total={total} filtered={sort ? sort.filtered : true} query={query} />}
        </span>
      </div>
      {message && !selecting && <p className="small muted" role="status">{message}</p>}

      <Gallery photos={photos} base={170} showWhen query={query} selected={selected} onToggle={selecting ? toggle : undefined} starred={sort?.favorites} flagged={sort?.tagging} />

      {selecting && (
        <div className="select-bar-wrap">
          {panel && (
            <div className="select-panel" role="dialog" aria-label="Change selected photos">
              {panel === "date" && (
                <form onSubmit={applyDate} className="row-2" style={{ alignItems: "end" }}>
                  <div className="field">
                    <label htmlFor="bulk-year">Year</label>
                    <input id="bulk-year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1958" autoFocus />
                  </div>
                  <div className="field">
                    <label htmlFor="bulk-decade">Or decade</label>
                    <select id="bulk-decade" value={decade} onChange={(e) => setDecade(e.target.value)} disabled={!!year.trim()}>
                      <option value="">Not sure</option>
                      {Array.from({ length: 10 }, (_, i) => 1930 + i * 10).map((d) => <option key={d} value={d}>{d}s</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" disabled={busy}>Set date</button>
                </form>
              )}
              {panel === "occasion" && <TagPicker label="Add occasion" options={occasions} value={[]} onChange={pick("occasion")} placeholder="Christmas, Birthday, Summer" />}
              {panel === "album" && <AlbumAdd albums={albums.filter((a) => a.id !== inAlbum?.id)} busy={busy} onAdd={addToAlbum} />}
              {panel === "person" && <TagPicker label="Add person" options={people} value={[]} onChange={pick("person")} placeholder="Start typing a name" />}
            </div>
          )}
          <div className="select-bar" role="toolbar" aria-label="Selected photos">
            <strong>{selected.length} selected</strong>
            {selected.length < photos.length && (
              <button type="button" onClick={() => { setSelected(photos.map((p) => p.id)); setMessage(""); }}>
                Select all{photos.length > 1 ? ` ${photos.length}` : ""}
              </button>
            )}
            {selected.length > 0 ? (
              <>
                <span className="bar-divider" aria-hidden="true" />
                <button type="button" aria-pressed={panel === "date"} onClick={() => setPanel(panel === "date" ? null : "date")} disabled={busy}>Set year or decade</button>
                <button type="button" aria-pressed={panel === "occasion"} onClick={() => setPanel(panel === "occasion" ? null : "occasion")} disabled={busy}>Add occasion</button>
                <button type="button" aria-pressed={panel === "person"} onClick={() => setPanel(panel === "person" ? null : "person")} disabled={busy}>Add person</button>
                <button type="button" aria-pressed={panel === "album"} onClick={() => setPanel(panel === "album" ? null : "album")} disabled={busy}>Add to album</button>
                {inAlbum && <button type="button" onClick={takeOut} disabled={busy}>Take out of album</button>}
                {removable > 0 && <button type="button" className="danger" onClick={remove} disabled={busy}>Remove</button>}
                <button type="button" className="clear" onClick={() => { setSelected([]); setPanel(null); }}>Clear</button>
              </>
            ) : (
              <span className="bar-hint">Click photos to select them</span>
            )}
          </div>
          {(error || message) && <p className={`bar-note${error ? " error" : ""}`} role="status">{error || message}</p>}
        </div>
      )}
    </>
  );
}
