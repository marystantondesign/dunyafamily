"use client";
import Link from "next/link";
import { useState } from "react";
import { Sprig } from "./ComeIn";
import { PersonPicker, pickedName, type Pickable, type Picked } from "./PersonPicker";

export function SwitchPerson({ people, current }: { people: Pickable[]; current: number | null }) {
  const [picked, setPicked] = useState<Picked>(current ? { personId: current } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = pickedName(picked, people);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!picked || ("newName" in picked && !picked.newName.trim())) return setError("Choose who you are, or add your name.");
    setBusy(true);
    const res = await fetch("/api/enter/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(picked) });
    if (!res.ok) { setBusy(false); return setError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again."); }
    window.location.href = "/";
  }

  return (
    <form className="come-in" onSubmit={submit}>
      <div className="come-in-head">
        <Sprig size={36} />
        <h1>Who&apos;s here?</h1>
        <p>Pick yourself so the family knows who shared what.</p>
      </div>
      <PersonPicker people={people} value={picked} onChange={setPicked} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary come-in-go" disabled={busy}>{busy ? "One moment" : name ? `Continue as ${name}` : "Continue"}</button>
      <Link href="/" className="small" style={{ textAlign: "center" }}>Cancel</Link>
    </form>
  );
}
