"use client";
import { useEffect, useRef, useState } from "react";
import type { AlbumOption } from "./AlbumPicker";
import { Icon } from "./Icon";

const plural = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

/** An even 2x2 cover of four photos; with fewer than four, the first photo fills the square. */
export function AlbumQuad({ urls, className = "" }: { urls: string[]; className?: string }) {
  const four = urls.length >= 4;
  return (
    <span className={`sa-quad${four ? "" : " one"}${className ? ` ${className}` : ""}`} aria-hidden="true">
      {four
        // eslint-disable-next-line @next/next/no-img-element
        ? urls.slice(0, 4).map((u, i) => <img key={i} src={u} alt="" />)
        // eslint-disable-next-line @next/next/no-img-element
        : urls[0] ? <img src={urls[0]} alt="" /> : <span className="sa-blank" />}
    </span>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

/** Add to album: only the albums this person started, each with its cover. Tapping one adds the photos. */
export function AddToAlbumScreen({ albums, count, busy, error, onCancel, onPick }: {
  albums: AlbumOption[]; count: number; busy: boolean; error: string; onCancel: () => void; onPick: (a: AlbumOption) => void;
}) {
  useEscape(onCancel);
  return (
    <div className="sa-screen" role="dialog" aria-modal="true" aria-labelledby="sa-add-title">
      <div className="sa-panel">
        <header className="sa-head">
          <button type="button" className="sa-cancel" onClick={onCancel}>Cancel</button>
          <h2 id="sa-add-title">Add to album</h2>
          <span aria-hidden="true" />
        </header>
        <div className="sa-body">
          <p className="sa-sub">{count} {count === 1 ? "photo" : "photos"} selected</p>
          {error && <p className="error" role="alert">{error}</p>}
          <ul className="sa-grid">
            {albums.map((a) => (
              <li key={a.id}>
                <button type="button" className="sa-album" disabled={busy} onClick={() => onPick(a)}>
                  <AlbumQuad urls={a.covers ?? (a.coverUrl ? [a.coverUrl] : [])} />
                  <span className="sa-album-name">{a.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** New album: a cover from the selected photos, how many, and the name. Create stays off until there's a name. */
export function NewAlbumScreen({ covers, count, busy, error, onCancel, onCreate }: {
  covers: string[]; count: number; busy: boolean; error: string; onCancel: () => void; onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEscape(onCancel);
  useEffect(() => { input.current?.focus(); }, []);
  const ready = !!title.trim() && !busy;
  return (
    <div className="sa-screen" role="dialog" aria-modal="true" aria-labelledby="sa-new-title">
      <form className="sa-panel" onSubmit={(e) => { e.preventDefault(); if (ready) onCreate(title.trim()); }}>
        <header className="sa-head">
          <button type="button" className="sa-cancel" onClick={onCancel}>Cancel</button>
          <h2 id="sa-new-title">New album</h2>
          <button type="submit" className="sa-create" disabled={!ready}>{busy ? "One moment" : "Create"}</button>
        </header>
        <div className="sa-body sa-new">
          <div className="sa-new-cover">
            <AlbumQuad urls={covers} />
            <span className="sa-sub">{plural(count)}</span>
          </div>
          <label className="sa-field">
            <span>Album name</span>
            <input ref={input} placeholder="Name your album" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </form>
    </div>
  );
}

/** A short dark message with a check, near the bottom of the screen; it fades after a few seconds. */
export function Toast({ text, onDone }: { text: string; onDone?: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setLeaving(true), 3200);
    const b = setTimeout(() => onDone?.(), 3700);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [onDone]);
  return (
    <div className={`sa-toast${leaving ? " leaving" : ""}`} role="status">
      <span className="sa-toast-check"><Icon name="check" size={14} stroke={3} /></span>
      {text}
    </div>
  );
}
