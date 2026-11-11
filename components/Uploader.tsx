"use client";
import exifr from "exifr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AlbumOption } from "./AlbumPicker";
import { Icon } from "./Icon";
import { TagPicker, type Option, type Picked } from "./TagPicker";

type Item = {
  // body is what gets uploaded: the file itself, or a JPEG copy of an iPhone HEIC photo so every browser can show it.
  key: string; file: File; body?: Blob; preview?: string; thumb?: Blob; width?: number; height?: number;
  takenOn?: string | null; state: "ready" | "uploading" | "done" | "error"; message?: string;
  /** Selected for upload. Clicking a photo deselects it (and clicking again brings it back). */
  on: boolean;
};
const THUMB_MAX = 800;
const SCANS_KEY = "df_scans";
/** Phone photos are stored at about this size on the long edge (roughly 300 to 500 KB). Scans keep full quality. */
const PHONE_MAX = 2400;
const BATCH = 10;
/** Phone photos a day for everyone but Mary (lib/uploads DAILY_LIMIT). */
const DAILY = 30;
// Ready, or failed to upload and worth trying again. Files the browser couldn't read have no thumbnail.
const retryable = (i: Item) => i.state === "ready" || (i.state === "error" && !!i.thumb);

const isHeic = (f: File) => /^image\/hei[cf]/.test(f.type) || /\.hei[cf]$/i.test(f.name);
const toBlob = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/jpeg", quality));

/** iPhone photos (HEIC) become a full-size JPEG. Safari can draw them itself; other browsers load a converter. */
async function heicToJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    return await toBlob(canvas, 0.92);
  } catch {
    const { heicTo } = await import("heic-to");
    return heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  }
}

async function prepare(file: File): Promise<Item> {
  const key = `${file.name}-${file.size}-${file.lastModified}`;
  try {
    const body = isHeic(file) ? await heicToJpeg(file) : undefined;
    const bitmap = await createImageBitmap(body ?? file, { imageOrientation: "from-image" });
    const scale = Math.min(1, THUMB_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumb = await toBlob(canvas, 0.82);
    let takenOn: string | null = null;
    try {
      const exif = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
      const d: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate;
      if (d instanceof Date && !isNaN(d.getTime()) && d.getFullYear() > 1900)
        takenOn = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch { /* scans and screenshots usually have no date */ }
    return { key, file, body, thumb, preview: URL.createObjectURL(thumb), width: bitmap.width, height: bitmap.height, takenOn, state: "ready", on: true };
  } catch {
    return { key, file, state: "error", message: "This browser can't read that file type. Try saving it as JPEG.", on: false };
  }
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]); }));
}

/** A phone photo at display size: about 2400 px on the long edge as a JPEG. Small ones go up as they are. */
async function forPhone(src: Blob): Promise<{ blob: Blob; type: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(src, { imageOrientation: "from-image" });
  const scale = Math.min(1, PHONE_MAX / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && src.type === "image/jpeg" && src.size < 700_000) return { blob: src, type: "image/jpeg", width: bitmap.width, height: bitmap.height };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { blob: await toBlob(canvas, 0.82), type: "image/jpeg", width: canvas.width, height: canvas.height };
}

/** Waits while the page is hidden (a phone asleep or another app open), so uploads pick up where they left off. */
const whenVisible = () => document.visibilityState === "visible" ? Promise.resolve()
  : new Promise<void>((res) => { const on = () => { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", on); res(); } }; document.addEventListener("visibilitychange", on); });

/** A PUT that tries again (after the page is visible) when a phone drops the connection. */
async function put(url: string, body: Blob, type: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await whenVisible();
    try {
      const r = await fetch(url, { method: "PUT", body, headers: { "Content-Type": type } });
      if (r.ok) return;
    } catch { /* try again */ }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error("upload");
}

/** "These are photos of old prints": the switch card. */
function ScansSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`ap-switch${on ? " on" : ""}`} onClick={() => onChange(!on)}>
      <span className="ap-switch-text">
        <span className="ap-switch-title">These are photos of old prints</span>
        <span className="ap-switch-sub">Turn this on to <b>ignore</b> the date that your phone adds.</span>
      </span>
      <span className="ap-track" aria-hidden="true"><span className="ap-knob" /></span>
    </button>
  );
}

/**
 * Add photos. "These are photos of old prints" on: no daily limit, the camera date is ignored, and Year or decade can
 * be set. Off: the camera date is the photo's date, and people other than Mary can add 30 a day. Photos go up in
 * small batches in the background (phone photos resized first) and pick up again if the phone sleeps.
 */
export function Uploader({ occasions, albums, startAlbum, left, title = "Add photos", children }: {
  occasions: Option[]; albums: AlbumOption[]; startAlbum?: number; title?: string;
  /** Phone photos this person can still add today; null for no limit (the admin). */
  left: number | null;
  /** Shown before any photos are chosen (recently added photos). */
  children?: React.ReactNode;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const album = startAlbum && albums.some((a) => a.id === startAlbum) ? { albumId: startAlbum } : null;
  const [occ, setOcc] = useState<Picked[]>([]);
  const [year, setYear] = useState("");
  const [decade, setDecade] = useState("");
  // Most of the archive is phone pictures of old prints, so this starts on until someone says otherwise.
  const [scans, setScans] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; batch: string | null } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [reading, setReading] = useState(0);
  const [review, setReview] = useState(false);
  const [remaining, setRemaining] = useState(left);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
  const toggle = (key: string) => setItems((prev) => prev.map((i) => (i.key === key && retryable(i) ? { ...i, on: !i.on } : i)));

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setNotice(null);
    const files = Array.from(list).filter((f) => (f.type.startsWith("image/") || isHeic(f)) && !items.some((i) => i.key === `${f.name}-${f.size}-${f.lastModified}`));
    setReading((r) => r + files.length);
    // A few at a time: iPhone photos are converted at full size, which takes memory.
    const prepared: Item[] = new Array(files.length);
    await pool(files.map((f, n) => ({ f, n })), 4, async ({ f, n }) => { prepared[n] = await prepare(f); setReading((r) => r - 1); });
    setItems((prev) => [...prev, ...prepared]);
  }

  async function save() {
    const chosen = items.filter((i) => i.on && retryable(i));
    if (!chosen.length) return setError("Choose at least one photo.");
    const y = scans && year.trim() ? Number(year) : null;
    if (y !== null && (isNaN(y) || y < 1850 || y > new Date().getFullYear())) return setError("That year doesn't look right.");
    // Phone photos past today's limit wait for tomorrow.
    const cap = scans || remaining === null ? chosen.length : remaining;
    const ready = chosen.slice(0, cap);
    const held = chosen.length - ready.length;
    setBusy(true);
    setError("");
    setNotice(null);
    let lock: { release: () => Promise<void> } | null = null;
    try { lock = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen") ?? null; } catch { /* not supported */ }
    let batch: string | undefined;
    let added = 0;
    let limited = false;
    setProgress({ done: 0, total: ready.length });
    try {
      for (let at = 0; at < ready.length; at += BATCH) {
        const group = ready.slice(at, at + BATCH);
        // Phone photos are resized to display size first; scans go up at full quality.
        const files = await Promise.all(group.map(async (item) => {
          const src = item.body ?? item.file;
          if (scans) return { item, blob: src, type: item.body ? "image/jpeg" : item.file.type, width: item.width, height: item.height };
          const r = await forPhone(src);
          return { item, ...r };
        }));
        await whenVisible();
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: files.map((f) => ({ type: f.type })) }),
        });
        if (!signRes.ok) throw new Error((await signRes.json().catch(() => ({}))).error);
        const signed: { originalKey: string; thumbKey: string; originalUrl: string; thumbUrl: string; contentType: string }[] = await signRes.json();
        const okd: { f: (typeof files)[number]; s: (typeof signed)[number] }[] = [];
        await pool(files.map((f, n) => ({ f, s: signed[n] })), 3, async ({ f, s }) => {
          update(f.item.key, { state: "uploading" });
          try {
            await put(s.originalUrl, f.blob, s.contentType);
            await put(s.thumbUrl, f.item.thumb!, "image/jpeg");
            okd.push({ f, s });
          } catch {
            update(f.item.key, { state: "error", message: "Upload failed" });
          }
        });
        if (okd.length) {
          await whenVisible();
          const res = await fetch("/api/photos", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              photos: okd.map(({ f, s }) => ({ originalKey: s.originalKey, thumbKey: s.thumbKey, width: f.width, height: f.height, takenOn: scans ? null : f.item.takenOn })),
              tags: { people: [], occasions: occ, year: y, decade: scans && !y && decade ? Number(decade) : null },
              scans, album, batch,
            }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
          const out = (await res.json()) as { ids: number[]; batch: string | null; limited?: boolean; left?: number | null };
          batch = out.batch ?? batch;
          const saved = new Set(okd.slice(0, out.ids.length).map(({ f }) => f.item.key));
          for (const k of saved) update(k, { state: "done" });
          added += out.ids.length;
          if (out.left !== undefined && out.left !== null) setRemaining(out.left);
          if (out.limited) { limited = true; break; }
        }
        setProgress({ done: Math.min(at + group.length, ready.length), total: ready.length });
      }
      // What went up leaves the selection; anything that didn't stays, ready to try again.
      setItems((prev) => prev.filter((i) => i.state !== "done").map((i) => (i.state === "error" && i.thumb ? { ...i, state: "ready" } : i)));
      const failed = ready.length - added;
      if (held > 0 || limited) {
        setNotice({ text: `You've added ${DAILY} today. Come back tomorrow to add more.`, batch: batch ?? null });
      } else if (failed > 0) {
        setError(`${added} added. ${failed} didn't upload. Try those again, then tag them all.`);
      } else if (batch) {
        // Straight into tagging this upload.
        setLeaving(true);
        router.push(`/tag?batch=${batch}`);
      }
    } catch (e) {
      setItems((prev) => prev.filter((i) => i.state !== "done").map((i) => (i.state !== "ready" && i.thumb ? { ...i, state: "ready" } : i)));
      setError(e instanceof Error && e.message ? e.message : `Something went wrong.${added ? ` ${added} photos were saved.` : ""} Try again to add the rest.`);
    } finally {
      setBusy(false);
      setProgress(null);
      lock?.release().catch(() => undefined);
    }
  }

  const picked = items.filter((i) => i.on && retryable(i));
  const count = picked.length;
  const withDates = picked.filter((i) => i.takenOn).length;
  const leftAfter = remaining === null ? null : Math.max(0, remaining - count);
  const status = scans ? null : `${withDates} with a date from the camera${leftAfter === null ? "" : ` · ${leftAfter} of ${DAILY} left today`}`;
  const choose = () => input.current?.click();
  const fileInput = <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />;
  const drop = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); },
  };
  const tile = (i: Item, big: boolean) => (
    <button key={i.key} type="button" className={`ap-tile${big ? " big" : ""}${i.on ? "" : " off"}`} aria-pressed={i.on} title={i.message}
      aria-label={i.on ? `Selected: ${i.file.name}` : `Not selected: ${i.file.name}`} onClick={() => !busy && toggle(i.key)} disabled={!i.thumb}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {i.preview && <img src={i.preview} alt="" />}
      {big && <span className="ap-check" aria-hidden="true">{i.on && <Icon name="check" size={14} stroke={2.6} />}</span>}
      {i.state === "uploading" && <span className="state">Uploading</span>}
      {i.state === "error" && <span className="state">{i.thumb ? "Upload failed" : "Can't add"}</span>}
    </button>
  );

  if (leaving) return <p className="lede" role="status" style={{ marginTop: 24 }}>Opening tagging for these photos.</p>;

  return (
    <div className="ap">
      {fileInput}
      <div className="ap-left">
        <div className="ap-titlerow">
          <h1 className="ap-h1">{title}</h1>
          <button type="button" className="ap-more phone-only" onClick={choose}><Icon name="upload" size={18} /> {items.length ? "Upload more" : "Choose photos"}</button>
        </div>
        <div className="phone-only ap-phone-switch">
          <ScansSwitch on={scans} onChange={chooseScans} />
          <p className="ap-status">{scans ? "Scans have no daily limit." : status}</p>
        </div>
        {items.length > 0 ? (
          <>
            <div className="ap-counthead">
              <h2>{count} {count === 1 ? "photo" : "photos"} selected</h2>
              <button type="button" className="ap-review phone-only" onClick={() => setReview(true)}>Review all</button>
            </div>
            {status && <p className="ap-status desktop-only">{status}</p>}
            <div className="ap-strip phone-only">{items.map((i) => tile(i, false))}</div>
            <div className="ap-grid desktop-only">{items.map((i) => tile(i, true))}</div>
          </>
        ) : (
          <div className="ap-empty">
            <p className="muted">{reading > 0 ? `Getting ${reading} ${reading === 1 ? "photo" : "photos"} ready` : "Choose photos from your phone or computer. Up to 300 at a time."}</p>
            {children}
          </div>
        )}
        {reading > 0 && items.length > 0 && <p className="hint" role="status">Getting {reading} {reading === 1 ? "photo" : "photos"} ready</p>}
      </div>

      <div className="ap-card">
        <div className="desktop-only"><ScansSwitch on={scans} onChange={chooseScans} /></div>
        <div className={`ap-drop desktop-only${over ? " over" : ""}`} {...drop}>
          <span className="ap-drop-text"><Icon name="upload" size={18} /> {items.length ? "Drag more photos here, or" : "Drag photos here, or"}</span>
          <button type="button" className="ap-more" onClick={choose}>{items.length ? "Upload more" : "Choose photos"}</button>
        </div>
        <h2 className="ap-h2">Optional bulk details</h2>
        <p className="ap-sub">These details will apply to everything you&apos;re uploading. You can still add more details later</p>
        {scans && (
          <div className="ap-daterow">
            <div className="field">
              <label htmlFor="year">Year</label>
              <input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1958" />
            </div>
            <div className="field">
              <label htmlFor="decade">Or decade</label>
              <select id="decade" value={decade} onChange={(e) => setDecade(e.target.value)} disabled={!!year.trim()}>
                <option value="">Not sure</option>
                {Array.from({ length: 10 }, (_, i) => 1940 + i * 10).map((d) => <option key={d} value={d}>{d}s</option>)}
              </select>
            </div>
          </div>
        )}
        <TagPicker label="Occasion" options={occasions} value={occ} onChange={setOcc} placeholder="Christmas, Birthday, Summer" />
        {progress && (
          <div className="ap-progress" role="status">
            <span>Uploading {progress.done} of {progress.total}</span>
            <span className="ap-bar" aria-hidden="true"><span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></span>
          </div>
        )}
        {notice && (
          <p className="ap-notice" role="status">
            {notice.text}{notice.batch && <> <a href={`/tag?batch=${notice.batch}`}>Tag the ones you added</a></>}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <button type="button" className="ap-go" onClick={save} disabled={busy || !count}>
          {busy ? "Uploading" : `Upload ${count} ${count === 1 ? "photo" : "photos"}`}
        </button>
      </div>

      {review && (
        <div className="modal-backdrop" onClick={() => setReview(false)}>
          <div className="modal ap-review-sheet" role="dialog" aria-modal="true" aria-labelledby="ap-review-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 id="ap-review-title">{count} {count === 1 ? "photo" : "photos"} selected</h2>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => setReview(false)}><Icon name="x" size={22} /></button>
            </div>
            <div className="ap-grid">{items.map((i) => tile(i, true))}</div>
            <button type="button" className="ap-go" onClick={() => setReview(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
