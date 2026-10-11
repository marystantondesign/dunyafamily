"use client";
import { useState } from "react";

export function FamilyPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.trim().length < 6) return setError("Use at least 6 characters.");
    if (password.trim() !== confirm.trim()) return setError("The two passwords don't match.");
    if (!window.confirm("Change the family password? Everyone else will be signed out and will need the new one.")) return;
    setBusy(true);
    const res = await fetch("/api/admin/family-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirm }) });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    setDone(true);
    setPassword(""); setConfirm("");
  }

  if (done) return (
    <div className="card form-grid">
      <p role="status"><strong>The family password is changed.</strong></p>
      <p className="small">Everyone else is signed out now. Send the new password to the family the way you usually share it. You&apos;re still signed in as admin.</p>
    </div>
  );
  return (
    <form className="card form-grid" onSubmit={submit}>
      <div className="field">
        <label htmlFor="fp-new">New family password</label>
        <input id="fp-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fp-confirm">Type it again</label>
        <input id="fp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Change family password"}</button>
    </form>
  );
}
