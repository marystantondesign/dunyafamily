"use client";
import { useState } from "react";

export function EnterForm({ next }: { next: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-grid"
      style={{ marginTop: 24 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        const res = await fetch("/api/enter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: f.get("name"), password: f.get("password") }),
        });
        setBusy(false);
        if (!res.ok) return setError((await res.json()).error ?? "That didn't work. Try again.");
        window.location.href = next;
      }}
    >
      <div className="field">
        <label htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="given-name" placeholder="Lena" required />
        <span className="hint">Shown next to photos you add.</span>
      </div>
      <div className="field">
        <label htmlFor="password">Family password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Checking" : "Come in"}</button>
    </form>
  );
}
