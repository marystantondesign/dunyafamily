"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AlbumOption } from "./AlbumPicker";
import { Icon } from "./Icon";
import { AddToAlbumScreen, NewAlbumScreen, Toast } from "./SelectAlbums";
import { SortMenu } from "./BrowseFilters";
import { Gallery } from "./Gallery";
import { SlideshowStart } from "./SlideshowStart";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type BrowsePhoto = { id: number; url: string; width: number | null; height: number | null; year: number | null; decade: number | null; month: number | null; removable: boolean };
type Panel = "date" | "occasion" | "person" | null;

/** The browse gallery, plus select mode: check photos, then change them all at once. */
export function BrowseResults({ photos, query, people, occasions, albums, inAlbum, total, sort, allIdsQuery, startSelecting = false }: {
  photos: BrowsePhoto[]; query: string; people: Option[]; occasions: Option[];
  total: number;
  /** Browse only: the sort control, count, and slideshow. Album pages leave it out. */
  sort?: { value: string; fallback: string; params: Record<string, string>; filtered: boolean; favorites?: boolean; tagging?: boolean };
  albums: AlbumOption[];
  /** On an album page: select mode can also take photos out of this album. */
  inAlbum?: { id: number; title: string };
  /** Browse: "Select all N" picks every photo matching these filters, not just the ones loaded. */
  allIdsQuery?: string;
  /** Opened from an album's "Add more photos": start in select mode. */
  startSelecting?: boolean;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(startSelecting);
  const [screen, setScreen] = useState<"add" | "new" | null>(null);
  const [toast, setToast] = useState("");
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

  // While selecting on a phone, the filters and the tab bar make way for the selection bars.
  useEffect(() => {
    document.body.classList.toggle("br-selecting", selecting);
    return () => document.body.classList.remove("br-selecting");
  }, [selecting]);

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const removable = photos.filter((p) => selected.includes(p.id) && p.removable).length;
  const stop = () => { setSelecting(false); setSelected([]); setPanel(null); setScreen(null); setError(""); };
  const myAlbums = albums.filter((a) => a.id !== inAlbum?.id);
  const covers = photos.filter((p) => selected.includes(p.id)).slice(0, 4).map((p) => p.url);

  // Every photo matching the filters (Browse), or every photo on this page (an album).
  async function selectAll() {
    setMessage(""); setError("");
    if (!allIdsQuery && allIdsQuery !== "") return setSelected(photos.map((p) => p.id));
    try {
      const res = await fetch(`/api/photos/ids${allIdsQuery ? `?${allIdsQuery}` : ""}`);
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      setSelected(out.ids as number[]);
    } catch {
      setSelected(photos.map((p) => p.id));
    }
  }

  async function addTo(a: AlbumOption) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/albums/${a.id}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoIds: selected }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error);
      stop();
      setToast(`Added to ${a.title}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function create(title: string) {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, photoIds: selected }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error);
      window.location.assign(`/albums/${out.id}?created=1`);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error && e.message ? e.message : "That didn't work. Try again.");
    }
  }
  const openScreen = (which: "add" | "new") => { setError(""); setPanel(null); setScreen(which); };

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
              <span className="desktop-only">{total} {total === 1 ? "favorite" : "favorites"}. Only you see this list.</span>
              <span className="phone-only">{total} {total === 1 ? "favorite" : "favorites"}. Only you see these.</span>
            </>
          ) : <>{total} {total === 1 ? "photo" : "photos"}</>}
        </span>
        <span className="browse-actions">
          {sort && <span className="desktop-only"><SortMenu value={sort.value} fallback={sort.fallback} params={sort.params} /></span>}
          {selecting
            ? <button type="button" className="btn btn-dark done-selecting" onClick={stop}>Done selecting</button>
            : <button type="button" className="btn select-btn" onClick={() => { setSelecting(true); setMessage(""); }}>Select</button>}
          {!selecting && <SlideshowStart total={total} filtered={sort ? sort.filtered : true} query={query} />}
        </span>
      </div>
      {message && !selecting && <p className="small muted" role="status">{message}</p>}

      {/* Phone: the selection bar takes the place of the filters. */}
      {selecting && (
        <div className="sel-top phone-only">
          <strong>{selected.length} selected</strong>
          <span>
            {selected.length < total && <button type="button" className="sel-all" onClick={selectAll}>Select all {total}</button>}
            <button type="button" className="sel-done" onClick={stop}>Done</button>
          </span>
        </div>
      )}

      {/* Browse: no labels or badges on the tiles, under any sort. Album pages keep the year. */}
      <Gallery photos={photos} base={170} showWhen={!sort} query={query} selected={selected} onToggle={selecting ? toggle : undefined} starred={sort?.favorites} flagged={sort?.tagging} />

      {selecting && (
        <div className="select-bar-wrap desktop-only">
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
              {panel === "person" && <TagPicker label="Add person" options={people} value={[]} onChange={pick("person")} placeholder="Start typing a name" />}
            </div>
          )}
          <div className="select-bar" role="toolbar" aria-label="Selected photos">
            <strong>{selected.length} selected</strong>
            {selected.length < total && <button type="button" className="sel-all" onClick={selectAll}>Select all {total}</button>}
            {selected.length > 0 ? (
              <>
                <span className="bar-divider" aria-hidden="true" />
                <button type="button" aria-pressed={panel === "date"} onClick={() => setPanel(panel === "date" ? null : "date")} disabled={busy}>Set year or decade</button>
                <button type="button" aria-pressed={panel === "occasion"} onClick={() => setPanel(panel === "occasion" ? null : "occasion")} disabled={busy}>Add occasion</button>
                <button type="button" aria-pressed={panel === "person"} onClick={() => setPanel(panel === "person" ? null : "person")} disabled={busy}>Add person</button>
                {myAlbums.length > 0 && <button type="button" onClick={() => openScreen("add")} disabled={busy}>Add to album</button>}
                <button type="button" className="solid" onClick={() => openScreen("new")} disabled={busy}>New album</button>
                {inAlbum && <button type="button" onClick={takeOut} disabled={busy}>Take out of album</button>}
                {removable > 0 && <button type="button" className="danger" onClick={remove} disabled={busy}>Remove</button>}
                <button type="button" className="clear" onClick={() => { setSelected([]); setPanel(null); }}>Clear</button>
              </>
            ) : (
              <span className="bar-hint">Click photos to select them</span>
            )}
          </div>
          {(error || message) && !screen && <p className={`bar-note${error ? " error" : ""}`} role="status">{error || message}</p>}
        </div>
      )}

      {/* Phone: a dark sheet in place of the tab bar, with only the album actions. */}
      {selecting && (
        <section className={`sel-sheet phone-only${selected.length ? "" : " empty"}`} aria-label="Selected photos">
          <p className="sel-sheet-label"><span aria-hidden="true" />{selected.length ? `With ${selected.length} selected` : "Select photos to add"}</p>
          {myAlbums.length > 0 ? (
            <div className="sel-sheet-two">
              <button type="button" className="sel-outline" disabled={!selected.length || busy} onClick={() => openScreen("add")}><Icon name="album" size={20} /> Add to album</button>
              <button type="button" className="sel-white" disabled={!selected.length || busy} onClick={() => openScreen("new")}><Icon name="plus" size={20} stroke={2.2} /> New album</button>
            </div>
          ) : (
            <button type="button" className="sel-white" disabled={!selected.length || busy} onClick={() => openScreen("new")}><Icon name="plus" size={20} stroke={2.2} /> Create new album</button>
          )}
          {error && !screen && <p className="sel-sheet-error" role="alert">{error}</p>}
        </section>
      )}

      {screen === "add" && myAlbums.length > 0 && (
        <AddToAlbumScreen albums={myAlbums} count={selected.length} busy={busy} error={error} onCancel={() => { setScreen(null); setError(""); }} onPick={addTo} />
      )}
      {screen === "new" && (
        <NewAlbumScreen covers={covers} count={selected.length} busy={busy} error={error} onCancel={() => { setScreen(null); setError(""); }} onCreate={create} />
      )}
      {toast && <Toast text={toast} onDone={() => setToast("")} />}
    </>
  );
}
