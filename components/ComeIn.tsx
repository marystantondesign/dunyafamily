"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import { WhoPicker, type Pickable } from "./PersonPicker";

export function Sprig({ size = 48 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size * 1.6} viewBox="0 0 30 48" fill="none" stroke="var(--plum)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 46V10" />
      <path d="M15 14c-4-1-7-4-7-8 4 1 7 4 7 8zM15 14c4-1 7-4 7-8-4 1-7 4-7 8z" fill="var(--plum)" />
      <path d="M15 24c-4-1-7-4-7-8 4 1 7 4 7 8zM15 24c4-1 7-4 7-8-4 1-7 4-7 8z" fill="var(--plum)" />
      <path d="M15 4c-1.5 1.5-1.5 4 0 6 1.5-2 1.5-4.5 0-6z" fill="var(--plum)" />
    </svg>
  );
}

/** Come in: the family password, then "Who's here?" (only people who can sign in). */
export function ComeIn({ next, changed }: { next: string; changed?: boolean }) {
  const [password, setPassword] = useState("");
  const [people, setPeople] = useState<Pickable[] | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/enter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, ...body }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? "That didn't work. Try again.");
    return out;
  }

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const out = await post({ check: true });
      setPeople(out.people);
      setPhoto(out.photo ?? null);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  async function pick(personId: number) {
    setError("");
    setBusy(true);
    try {
      await post({ personId });
      window.location.href = next;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (people) {
    const back = <button type="button" className="text-btn" onClick={() => { setPeople(null); setPassword(""); setError(""); }}>Cancel</button>;
    return <WhoPicker people={people} photo={photo} busy={busy} error={error} onContinue={pick} cancel={back} />;
  }

  return (
    <form className="come-in" onSubmit={check}>
      <div className="come-in-head">
        <Sprig />
        <h1>Dunya Family</h1>
        <p>Our photos, birthdays, and gatherings, all in one place.</p>
      </div>
      {changed && <p className="notice" role="status">The family password has changed. Ask a family member for the new one.</p>}
      <div className="field">
        <label htmlFor="pw">Family password</label>
        <div className="pw-field">
          <Icon name="lock" size={20} />
          <input id="pw" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required autoFocus />
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary come-in-go" disabled={busy}>{busy ? "One moment" : "Continue"}</button>
    </form>
  );
}
