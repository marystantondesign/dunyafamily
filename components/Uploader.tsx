"use client";
import exifr from "exifr";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type Item = {
  key: string; file: File; preview?: string; thumb?: Blob; width?: number; height?: number;
  takenOn?: string | null; state: "ready" | "uploading" | "done" | "error"; message?: string;
};
const THUMB_MAX = 800;
const SHOWN = 15;
const SCANS_KEY = "df_scans";

async function prepare(file: File): Promise<Item> {
  const key = `${file.name}-${file.size}-${file.lastModified}`;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumb = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", 0.82));
    let takenOn: string | null = null;
    try {
      const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
      const d: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate;
      if (d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() > 1900)
        takenOn = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* scans and screenshots usually have no date */ }
    return { key, file, thumb, preview: URL.createObjectURL(thumb), width: bitmap.width, height: bitmap.height, takenOn, state: "ready" };
  } catch {
    return { key, file, state: "error", message: "This browser can't read that file type. Try saving it as JPEG." };
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

export function Uploader({ occasions }: { occasions: Option[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [occ, setOcc] = useState<Picked[]>([]);
  const [year, setYear] = useState("");
  const [decade, setDecade] = useState("");
  const [caption, setCaption] = useState("");
  // Most of the archive is phone pictures of old prints, so this starts checked until someone says otherwise.
  const [scans, setScans] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ count: number; batch: string; cover?: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SCANS_KEY);
      if (saved !== null) setScans(saved === "1");
    } catch { /* private browsing */ }
  }, []);

  function chooseScans(on: boolean) {
    setScans(on);
    try { localStorage.setItem(SCANS_KEY, on ? "1" : "0"); } catch { /* private browsing */ }
  }

  const update = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") && !items.some((i) => i.key === `${f.name}-${f.size}-${f.lastModified}`));
    const prepared = await Promise.all(files.map(prepare));
    setItems((prev) => [...prev, ...prepared]);
  }

  async function save() {
    const ready = items.filter((i) => i.state === "ready");
    if (!ready.length) return setError("Add at least one photo.");
    const y = year.trim() ? Number(year) : null;
    if (y !== null && (isNaN(y) || y < 1850 || y > new Date().getFullYear())) return setError("That year doesn't look right.");
    setBusy(true);
    setError("");
    try {
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: ready.map((i) => ({ type: i.file.type })) }),
      });
      if (!signRes.ok) throw new Error((await signRes.json()).error);
      const signed: { originalKey: string; thumbKey: string; originalUrl: string; thumbUrl: string; contentType: string }[] = await signRes.json();
      const pairs = ready.map((item, n) => ({ item, s: signed[n] }));

      const failed = new Set<string>();
      await pool(pairs, 3, async ({ item, s }) => {
        update(item.key, { state: "uploading" });
        try {
          const a = await fetch(s.originalUrl, { method: "PUT", body: item.file, headers: { "Content-Type": s.contentType } });
          const b = await fetch(s.thumbUrl, { method: "PUT", body: item.thumb, headers: { "Content-Type": "image/jpeg" } });
          if (!a.ok || !b.ok) throw new Error();
          update(item.key, { state: "done" });
        } catch {
          failed.add(item.key);
          update(item.key, { state: "error", message: "Upload failed" });
        }
      });

      const uploaded = pairs.filter((p) => !failed.has(p.item.key));
      if (!uploaded.length) throw new Error("None of the photos uploaded. Check your connection and try again.");
      const res = await fetch("/api/photos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: uploaded.map(({ item, s }) => ({ originalKey: s.originalKey, thumbKey: s.thumbKey, width: item.width, height: item.height, takenOn: scans ? null : item.takenOn })),
          tags: { people: [], occasions: occ, year: y, decade: !y && decade ? Number(decade) : null, caption },
          scans,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { batch } = (await res.json()) as { batch: string };
      setDone({ count: uploaded.length, batch, cover: uploaded[0].item.preview });
      // Keep any that failed so they can be tried again.
      setItems((prev) => prev.filter((i) => failed.has(i.key)).map((i) => ({ ...i, state: "ready", message: undefined })));
      setOcc([]); setYear(""); setDecade(""); setCaption(""); setShowAll(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Your photos weren't saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card done-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {done.cover && <img src={done.cover} alt="" className="done-cover" />}
        <h2 className="section-title">{done.count} {done.count === 1 ? "photo" : "photos"} added</h2>
        <p className="muted">Next, tag who&apos;s in each one. It takes a click or two per photo, and you can stop any time.</p>
        <div className="actions">
          <Link className="btn btn-primary" href={`/tag?batch=${done.batch}`}>Tag who&apos;s in them</Link>
          <button className="btn" onClick={() => setDone(null)}>Add more photos</button>
          <Link className="btn" href="/">Go home</Link>
        </div>
      </div>
    );
  }

  const withDates = items.filter((i) => i.takenOn).length;
  const readyCount = items.filter((i) => i.state === "ready").length;
  const shown = showAll ? items : items.slice(0, SHOWN);

  return (
    <div className="upload-layout">
      <div>
        <div
          className={`dropzone${over ? " over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>Drop photos here or choose from your device</p>
          <p className="hint" style={{ margin: "6px 0 0" }}>Up to 300 at a time</p>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>
        {items.length > 0 && (
          <>
            <p className="small muted" style={{ margin: "12px 0 0" }}>
              {items.length} selected{!scans && withDates > 0 && `, ${withDates} with a date from the camera`}
            </p>
            <div className="thumbs">
              {shown.map((i) => (
                <figure key={i.key} title={i.message ?? i.file.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.preview && <img src={i.preview} alt="" />}
                  {i.state === "ready" && !busy && (
                    <button className="x" aria-label={`Remove ${i.file.name}`} onClick={() => setItems((prev) => prev.filter((x) => x.key !== i.key))}>×</button>
                  )}
                  {i.state !== "ready" && <span className="state">{i.state === "uploading" ? "Uploading" : i.state === "done" ? "Done" : "Can't add"}</span>}
                </figure>
              ))}
            </div>
            {items.length > SHOWN && !showAll && (
              <button className="link-button small muted" onClick={() => setShowAll(true)}>and {items.length - SHOWN} more</button>
            )}
          </>
        )}
      </div>

      <div className="card form-grid">
        <div>
          <p className="label" style={{ margin: 0 }}>What&apos;s true for all of these</p>
          <p className="hint" style={{ margin: "4px 0 0" }}>Leave anything blank that varies. You can fill it in per photo later.</p>
        </div>
        <label className="check-card">
          <input type="checkbox" checked={scans} onChange={(e) => chooseScans(e.target.checked)} />
          <span>
            <strong>These are scans or photos of old prints</strong>
            <span className="hint">We&apos;ll ignore the date your phone or scanner saved, since it&apos;s not when the photo was taken.</span>
          </span>
        </label>
        <div className="row-2">
          <div className="field">
            <label htmlFor="year">Year</label>
            <input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1958" />
          </div>
          <div className="field">
            <label htmlFor="decade">Or decade</label>
            <select id="decade" value={decade} onChange={(e) => setDecade(e.target.value)} disabled={!!year.trim()}>
              <option value="">Not sure</option>
              {Array.from({ length: 10 }, (_, i) => 1930 + i * 10).map((d) => <option key={d} value={d}>{d}s</option>)}
            </select>
          </div>
        </div>
        {!scans && <span className="hint">Photos with a date from the camera keep their own date.</span>}
        <TagPicker label="Occasion" options={occasions} value={occ} onChange={setOcc} placeholder="Christmas, Birthday, Summer" />
        <div className="field">
          <label htmlFor="caption">A note for these (optional)</label>
          <textarea id="caption" rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Mama's senior year" />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" onClick={save} disabled={busy || !readyCount}>
          {busy ? "Adding photos" : `Add ${readyCount || ""} ${readyCount === 1 ? "photo" : "photos"}`}
        </button>
      </div>
    </div>
  );
}
