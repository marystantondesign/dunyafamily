"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagPicker, type Option, type Picked } from "./TagPicker";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function usePost() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: unknown) {
    setBusy(true);
    setError("");
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again."); return false; }
    router.refresh();
    return true;
  }
  return { post, error, busy };
}

export function AddBirthday({ people }: { people: Option[] }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<Picked[]>([]);
  const { post, error, busy } = usePost();
  if (!open) return <button className="btn" style={{ marginTop: 16 }} onClick={() => setOpen(true)}>Add a birthday</button>;
  return (
    <form
      className="card form-grid"
      style={{ marginTop: 16, maxWidth: 520 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        if (!who.length) return;
        if (await post("/api/birthdays", { person: who[0], month: Number(f.get("month")), day: Number(f.get("day")) })) { setWho([]); setOpen(false); }
      }}
    >
      <TagPicker label="Whose birthday" options={people} value={who} onChange={(v) => setWho(v.slice(-1))} placeholder="Start typing a name" />
      <div className="row-2">
        <div className="field">
          <label htmlFor="bm">Month</label>
          <select id="bm" name="month" required defaultValue="">
            <option value="" disabled>Choose</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bd">Day</label>
          <input id="bd" name="day" inputMode="numeric" required placeholder="14" />
        </div>
      </div>
      <span className="hint">Only the month and day are saved, so no one&apos;s age shows up anywhere.</span>
      {error && <p className="error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" disabled={busy || !who.length}>Save birthday</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function AddGathering() {
  const [open, setOpen] = useState(false);
  const { post, error, busy } = usePost();
  if (!open) return <button className="btn" style={{ marginTop: 16 }} onClick={() => setOpen(true)}>Add a gathering</button>;
  return (
    <form
      className="card form-grid"
      style={{ marginTop: 16, maxWidth: 520 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = Object.fromEntries(new FormData(e.currentTarget));
        if (await post("/api/gatherings", f)) setOpen(false);
      }}
    >
      <div className="field">
        <label htmlFor="gt">What</label>
        <input id="gt" name="title" required placeholder="Thanksgiving at Lena's" />
      </div>
      <div className="row-2">
        <div className="field">
          <label htmlFor="gd">Date</label>
          <input id="gd" name="date" type="date" required />
        </div>
        <div className="field">
          <label htmlFor="gtn">Time (optional)</label>
          <input id="gtn" name="timeNote" placeholder="Around 3pm" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="gl">Where (optional)</label>
        <input id="gl" name="location" placeholder="Lena's house" />
        <span className="hint">Shown here only, not in calendar apps.</span>
      </div>
      <div className="field">
        <label htmlFor="gn">Notes (optional)</label>
        <textarea id="gn" name="notes" rows={2} placeholder="Bring a dish. Kids table in the den." />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn btn-primary" disabled={busy}>Save gathering</button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
