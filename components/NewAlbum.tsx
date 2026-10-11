"use client";
import { useState } from "react";

/** "Start an album": name it, then land on its page to add photos. */
export function NewAlbum() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the album a name.");
    setBusy(true);
    const res = await fetch("/api/albums", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); return setError(out.error ?? "That didn't work. Try again."); }
    window.location.assign(`/albums/${out.id}`);
  }

  if (!open) return <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Start an album</button>;
  return (
    <form className="new-album" onSubmit={submit}>
      <div className="field">
        <label htmlFor="new-album-title">Album name</label>
        <input id="new-album-title" autoFocus placeholder="Memrie's wedding" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions" style={{ marginTop: 0 }}>
        <button className="btn btn-primary" disabled={busy}>{busy ? "One moment" : "Start album"}</button>
        <button type="button" className="btn" onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
      </div>
    </form>
  );
}
