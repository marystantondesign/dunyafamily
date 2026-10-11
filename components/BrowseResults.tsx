"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Gallery } from "./Gallery";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type BrowsePhoto = { id: number; url: string; width: number | null; height: number | null; year: number | null; decade: number | null; month: number | null; removable: boolean };
type Panel = "date" | "occasion" | "person" | null;

/** The browse gallery, plus select mode: check photos, then change them all at once. */
export function BrowseResults({ photos, query, tagHref, people, occasions }: {
  photos: BrowsePhoto[]; query: string; tagHref: string; people: Option[]; occasions: Option[];
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

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/photos/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected, ...body }),
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

  const pick = (action: "person" | "occasion") => (v: Picked[]) => { const last = v[v.length - 1]; if (last !== undefined) run({ action, value: last }); };

  return (
    <>
      <div className="browse-tools">
        <Link className="btn" href={tagHref}>Tag these</Link>
        {selecting
          ? <button type="button" className="btn btn-dark-outline" onClick={stop}>Done selecting</button>
          : <button type="button" className="btn" onClick={() => { setSelecting(true); setMessage(""); }}>Select</button>}
      </div>
      {message && !selecting && <p className="small muted" role="status">{message}</p>}

      <Gallery photos={photos} base={170} showWhen query={query} selected={selected} onToggle={selecting ? toggle : undefined} />

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
              {panel === "person" && <TagPicker label="Add person" options={people} value={[]} onChange={pick("person")} placeholder="Start typing a name" />}
            </div>
          )}
          <div className="select-bar" role="toolbar" aria-label="Selected photos">
            <strong>{selected.length} selected</strong>
            {selected.length > 0 ? (
              <>
                <span className="bar-divider" aria-hidden="true" />
                <button type="button" aria-pressed={panel === "date"} onClick={() => setPanel(panel === "date" ? null : "date")} disabled={busy}>Set year or decade</button>
                <button type="button" aria-pressed={panel === "occasion"} onClick={() => setPanel(panel === "occasion" ? null : "occasion")} disabled={busy}>Add occasion</button>
                <button type="button" aria-pressed={panel === "person"} onClick={() => setPanel(panel === "person" ? null : "person")} disabled={busy}>Add person</button>
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
