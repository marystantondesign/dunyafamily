"use client";
import { useState } from "react";
import { Icon } from "./Icon";

export type AlbumOption = { id: number; title: string; count: number; coverUrl: string | null };
export type AlbumPick = { albumId: number } | { newTitle: string } | null;

const plural = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

function Cover({ url }: { url: string | null }) {
  return (
    <span className="album-cover" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" /> : <Icon name="photo" size={22} />}
    </span>
  );
}

/** Upload (screen 07): one shared album for the whole batch, chosen from the list or started here. */
export function AlbumPicker({ albums, value, onChange }: { albums: AlbumOption[]; value: AlbumPick; onChange: (v: AlbumPick) => void }) {
  const [listing, setListing] = useState(false);
  const chosen = value && "albumId" in value ? albums.find((a) => a.id === value.albumId) : undefined;
  const naming = !!value && "newTitle" in value;

  return (
    <div className="album-picker">
      <span className="label" id="album-label">Shared album <span className="opt">(optional)</span></span>
      {chosen && !listing && (
        <div className="album-chosen">
          <Cover url={chosen.coverUrl} />
          <span><strong>{chosen.title}</strong><span>Everyone can add to this album</span></span>
          <span className="album-check"><Icon name="check" size={16} stroke={2.4} /></span>
        </div>
      )}
      {naming && (
        <div className="field">
          <label htmlFor="album-name" className="sr-only">New album name</label>
          <input id="album-name" autoFocus placeholder="Memrie's wedding" value={value.newTitle} onChange={(e) => onChange({ newTitle: e.target.value })} />
          <span className="hint">A new album everyone can add to.</span>
        </div>
      )}
      {listing && (
        <ul className="album-list" aria-labelledby="album-label">
          {albums.map((a) => (
            <li key={a.id}>
              <button type="button" aria-pressed={chosen?.id === a.id} onClick={() => { onChange({ albumId: a.id }); setListing(false); }}>
                <Cover url={a.coverUrl} />
                <span><strong>{a.title}</strong><span>{plural(a.count)}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="album-actions">
        {albums.length > 0 && !listing && (
          <button type="button" className="btn btn-pill" onClick={() => setListing(true)}>{chosen ? "Choose another" : "Choose an album"}</button>
        )}
        {!naming && <button type="button" className="btn btn-pill" onClick={() => { setListing(false); onChange({ newTitle: "" }); }}>New album</button>}
        {(chosen || naming || listing) && (
          <button type="button" className="text-btn quiet" onClick={() => { setListing(false); onChange(null); }}>No album</button>
        )}
      </div>
    </div>
  );
}

/** Photo options and select mode: tap an album to add to it, or name a new one. */
export function AlbumAdd({ albums, inAlbums = [], busy, onAdd }: {
  albums: AlbumOption[]; inAlbums?: number[]; busy?: boolean; onAdd: (pick: { albumId: number } | { newTitle: string }) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <div className="album-add">
      {albums.length > 0 && (
        <ul className="album-list">
          {albums.map((a) => {
            const inside = inAlbums.includes(a.id);
            return (
              <li key={a.id}>
                <button type="button" disabled={busy || inside} onClick={() => onAdd({ albumId: a.id })}>
                  <Cover url={a.coverUrl} />
                  <span><strong>{a.title}</strong><span>{inside ? "Already in this album" : plural(a.count)}</span></span>
                  {inside && <Icon name="check" size={18} className="album-in" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form className="album-new" onSubmit={(e) => { e.preventDefault(); if (title.trim()) onAdd({ newTitle: title }); }}>
        <label htmlFor="album-new-title">{albums.length ? "Or start a new album" : "Start a new album"}</label>
        <div className="album-new-row">
          <input id="album-new-title" placeholder="Memrie's wedding" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !title.trim()}>Add</button>
        </div>
      </form>
    </div>
  );
}
