"use client";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

type G = { id: number; title: string; date: string; timeNote: string; location: string; notes: string };

/** Edit a gathering (screen 22): Cancel and Save at the top, Delete at the bottom. */
export function EditGathering({ gathering, canEdit, note }: { gathering: G; canEdit: boolean; note: string }) {
  const [g, setG] = useState(gathering);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<G>) => setG((x) => ({ ...x, ...patch }));
  const back = `/calendar?day=${gathering.date}`;

  async function call(method: "PATCH" | "DELETE") {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/gatherings/${g.id}`, {
      method, headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ title: g.title, date: g.date, timeNote: g.timeNote, location: g.location, notes: g.notes }) : undefined,
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    // A full load, so the calendar never shows the version from before the change.
    window.location.assign(method === "PATCH" ? `/calendar?day=${g.date}` : "/calendar");
  }

  return (
    <form className="edit-sheet" onSubmit={(e) => { e.preventDefault(); if (canEdit) call("PATCH"); }}>
      <div className="edit-sheet-head">
        <Link href={back} className="text-btn quiet">Cancel</Link>
        <h1>{canEdit ? "Edit gathering" : "Gathering"}</h1>
        {canEdit ? <button className="text-btn" disabled={busy}>{busy ? "Saving" : "Save"}</button> : <span />}
      </div>
      <div className="field">
        <label htmlFor="eg-title">What</label>
        <input id="eg-title" value={g.title} onChange={(e) => set({ title: e.target.value })} disabled={!canEdit} required />
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="eg-date">Date</label>
          <input id="eg-date" type="date" value={g.date} onChange={(e) => set({ date: e.target.value })} disabled={!canEdit} required />
        </div>
        <div className="field">
          <label htmlFor="eg-time">Time</label>
          <input id="eg-time" value={g.timeNote} onChange={(e) => set({ timeNote: e.target.value })} placeholder="6:00 PM to 9:00 PM" disabled={!canEdit} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="eg-where">Where</label>
        <input id="eg-where" value={g.location} onChange={(e) => set({ location: e.target.value })} placeholder="At the Wilson home" disabled={!canEdit} />
        <span className="hint">Shown on the site only, not in calendar apps.</span>
      </div>
      <div className="field">
        <label htmlFor="eg-notes">Notes</label>
        <textarea id="eg-notes" rows={3} value={g.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Bring a dish. Kids table in the den." disabled={!canEdit} />
      </div>
      <p className="hint">{note}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {canEdit && <button type="button" className="btn danger-btn edit-sheet-delete" onClick={() => setConfirming(true)}>Delete gathering</button>}
      {confirming && (
        <ConfirmDialog
          title="Delete this gathering?"
          body="It comes off the calendar for everyone. Mary can restore it from Recently deleted."
          keep="Keep it"
          confirm="Delete gathering"
          onKeep={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); call("DELETE"); }}
        />
      )}
    </form>
  );
}
