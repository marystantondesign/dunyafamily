"use client";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/** Rename or delete an album: whoever started it, or Mary. Deleting keeps every photo on the site. */
export function AlbumActions({ id, title }: { id: number; title: string }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(title);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/albums/${id}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { setBusy(false); setError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again."); return false; }
    return true;
  }

  if (renaming) return (
    <form className="new-album" onSubmit={async (e) => { e.preventDefault(); if (await send("PATCH", { title: name })) window.location.reload(); }}>
      <div className="field">
        <label htmlFor="album-rename">Album name</label>
        <input id="album-rename" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn btn-primary" disabled={busy}>Save</button>
        <button type="button" className="btn" onClick={() => { setRenaming(false); setName(title); setError(""); }}>Cancel</button>
      </div>
    </form>
  );

  return (
    <>
      <button type="button" className="btn" onClick={() => setRenaming(true)}>Rename</button>
      <button type="button" className="btn btn-danger-quiet" onClick={() => setConfirming(true)}>Delete album</button>
      {error && <p className="error" role="alert">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title={`Delete ${title}?`}
          body="The album comes off the site, but every photo in it stays. It's kept in Recently deleted for 30 days in case you change your mind."
          keep="Keep it"
          confirm="Delete album"
          onKeep={() => setConfirming(false)}
          onConfirm={async () => { setConfirming(false); if (await send("DELETE")) window.location.assign("/albums"); }}
        />
      )}
    </>
  );
}
