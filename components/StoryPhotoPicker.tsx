"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { StoryFace } from "./StoriesIndex";
import { forPhone, prepare, put, ScansSwitch, SCANS_KEY, whenVisible, type Item } from "./Uploader";

export type PickedPhoto = { id: number; url: string | null };
type Person = { id: number; name: string; avatarUrl: string | null; inMemory: boolean };

/**
 * Add photos (Mary only): pick photos already on the site or upload new ones (they go into the family archive,
 * tagged with the people in the story). Multi-select inserts photos into her answer; single-select swaps one photo
 * or sets the main photo. Full screen on phones, a centered window on desktop.
 */
export function StoryPhotoPicker({ multi, people, onClose, onAdd }: {
  multi: boolean; people: Person[]; onClose: () => void; onAdd: (photos: PickedPhoto[]) => void;
}) {
  const [tab, setTab] = useState<"site" | "upload">("site");
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PickedPhoto[] | null>(null);
  const [fresh, setFresh] = useState<PickedPhoto[]>([]);
  const [picked, setPicked] = useState<PickedPhoto[]>([]);
  const [scans, setScans] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape closes; the page behind doesn't scroll while this is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    try { setScans(localStorage.getItem(SCANS_KEY) === "1"); } catch { /* private mode */ }
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !upload) onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose, upload]);

  // The grid: a search across the archive, or one person's photos.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q: search, ...(person ? { person: String(person) } : {}) });
        const out = await (await fetch(`/api/stories/photos?${qs}`)).json();
        if (live) setPhotos(out.photos ?? []);
      } catch { if (live) setPhotos([]); }
    }, search ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [search, person]);

  const toggle = (p: PickedPhoto) => setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : multi ? [...cur, p] : [p]));
  const grid = [...fresh, ...(photos ?? []).filter((p) => !fresh.some((f) => f.id === p.id))];

  async function uploadFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => f.type.startsWith("image/") || /\.hei[cf]$/i.test(f.name)).slice(0, multi ? 40 : 1);
    if (!files.length) return;
    setError("");
    setUpload({ done: 0, total: files.length });
    const added: PickedPhoto[] = [];
    let batch: string | undefined;
    try {
      for (let at = 0; at < files.length; at += 10) {
        const items: Item[] = (await Promise.all(files.slice(at, at + 10).map(prepare))).filter((i) => i.state === "ready");
        const ready = await Promise.all(items.map(async (item) => {
          const src = item.body ?? item.file;
          if (scans) return { item, blob: src, type: item.body ? "image/jpeg" : item.file.type, width: item.width, height: item.height };
          return { item, ...(await forPhone(src)) };
        }));
        if (!ready.length) continue;
        await whenVisible();
        const signRes = await fetch("/api/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: ready.map((f) => ({ type: f.type })) }) });
        if (!signRes.ok) throw new Error();
        const signed: { originalKey: string; thumbKey: string; originalUrl: string; thumbUrl: string; contentType: string }[] = await signRes.json();
        for (let n = 0; n < ready.length; n++) {
          await put(signed[n].originalUrl, ready[n].blob, signed[n].contentType);
          await put(signed[n].thumbUrl, ready[n].item.thumb!, "image/jpeg");
        }
        const res = await fetch("/api/photos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photos: ready.map((f, n) => ({ originalKey: signed[n].originalKey, thumbKey: signed[n].thumbKey, width: f.width, height: f.height, takenOn: scans ? null : f.item.takenOn })),
            tags: { people: people.map((p) => p.id), occasions: [] }, scans, batch,
          }),
        });
        if (!res.ok) throw new Error();
        const out = (await res.json()) as { ids: number[]; batch: string | null };
        batch = out.batch ?? batch;
        out.ids.forEach((id, n) => added.push({ id, url: ready[n].item.preview ?? null }));
        setUpload({ done: Math.min(at + 10, files.length), total: files.length });
      }
      if (!added.length) setError("Those files couldn't be read. Try saving them as JPEG.");
      setFresh((cur) => [...added, ...cur]);
      setPicked((cur) => (multi ? [...cur, ...added] : added.slice(0, 1)));
      setTab("site");
    } catch {
      if (added.length) { setFresh((cur) => [...added, ...cur]); setPicked((cur) => (multi ? [...cur, ...added] : added.slice(0, 1))); }
      setError("Some photos didn't upload. Try those again.");
    } finally {
      setUpload(null);
    }
  }

  const n = picked.length;
  return (
    <div className="pk-backdrop" data-keep-cursor onMouseDown={(e) => { if (e.target === e.currentTarget && !upload) onClose(); }}>
      <div ref={sheetRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={multi ? "Add photos to the story" : "Choose a photo"} className="pk-sheet">
        <div className="pk-head">
          <button type="button" className="pk-cancel" onClick={onClose} disabled={!!upload}>Cancel</button>
          <h2>Add photos</h2>
          <span aria-hidden="true" />
        </div>
        <div className="pk-body">
          <div role="tablist" aria-label="Photo source" className="pk-tabs">
            <button type="button" role="tab" aria-selected={tab === "site"} className={tab === "site" ? "on" : ""} onClick={() => setTab("site")}>From the site</button>
            <button type="button" role="tab" aria-selected={tab === "upload"} className={tab === "upload" ? "on" : ""} onClick={() => setTab("upload")}>Upload new</button>
          </div>
          {tab === "site" ? (
            <>
              <label className="pk-search">
                <Icon name="search" size={20} />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search photos, people, occasions" aria-label="Search photos, people, occasions" />
              </label>
              {people.length > 0 && (
                <div className="pk-people">
                  <span>Photos of people in this story</span>
                  <div>
                    {people.map((p) => (
                      <button key={p.id} type="button" aria-pressed={person === p.id} className={`pk-person${person === p.id ? " on" : ""}`} onClick={() => setPerson(person === p.id ? null : p.id)}>
                        <StoryFace p={p} size={26} />{p.name.split(/\s+/)[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="pk-error" role="alert">{error}</p>}
              {photos === null ? <p className="pk-note">Loading photos</p> : grid.length === 0 ? <p className="pk-note">No photos match.</p> : (
                <div className="pk-grid">
                  {grid.map((p) => {
                    const on = picked.some((x) => x.id === p.id);
                    return (
                      <button key={p.id} type="button" aria-pressed={on} aria-label={`Photo ${p.id}`} className={`pk-tile${on ? " on" : ""}`} onClick={() => toggle(p)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.url && <img src={p.url} alt="" loading="lazy" />}
                        <span className="pk-check" aria-hidden="true">{on && <Icon name="check" size={14} stroke={3} />}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`pk-drop${drag ? " drag" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); if (!upload) uploadFiles(e.dataTransfer.files); }}>
                <Icon name="photo" size={32} />
                {upload ? <span className="pk-drop-text" role="status">Uploading {upload.done} of {upload.total}</span> : (
                  <>
                    <span className="pk-drop-text phone-only">Pick new photos from your phone</span>
                    <span className="pk-drop-text desktop-only">Drag photos here, or</span>
                    <button type="button" className="pk-choose" onClick={() => fileRef.current?.click()}>Choose photos</button>
                  </>
                )}
                <span className="pk-drop-note">New photos are also added to the family archive, tagged with the people in this story.</span>
                <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple={multi} hidden onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
              </div>
              <ScansSwitch on={scans} onChange={(on) => { setScans(on); try { localStorage.setItem(SCANS_KEY, on ? "1" : "0"); } catch { /* private mode */ } }} />
              {error && <p className="pk-error" role="alert">{error}</p>}
            </>
          )}
        </div>
        <div className="pk-foot">
          <span>{n === 0 ? "Tap photos to choose" : `${n} ${n === 1 ? "photo" : "photos"} selected`}</span>
          <button type="button" className="pk-add" disabled={!n || !!upload} onClick={() => onAdd(picked)}>
            {n === 0 ? "Add photos" : `Add ${n} ${n === 1 ? "photo" : "photos"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
