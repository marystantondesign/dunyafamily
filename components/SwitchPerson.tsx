"use client";
import Link from "next/link";
import { useState } from "react";
import { WhoPicker, type Pickable } from "./PersonPicker";

/** "Not Mary? Switch person": same device, same password, someone else who can sign in. */
export function SwitchPerson({ people, current, photo }: { people: Pickable[]; current: number | null; photo: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go(personId: number) {
    setError("");
    setBusy(true);
    const res = await fetch("/api/enter/switch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId }) });
    if (!res.ok) { setBusy(false); return setError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again."); }
    window.location.href = "/";
  }

  return <WhoPicker people={people} photo={photo} initial={current} busy={busy} error={error} onContinue={go} cancel={<Link href="/">Cancel</Link>} />;
}
