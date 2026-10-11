"use client";
import { useState } from "react";

export function RestoreButton({ type, id }: { type: string; id: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  async function go() {
    setState("busy");
    setError("");
    const res = await fetch("/api/admin/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id }) });
    if (res.ok) return setState("done");
    setError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
    setState("idle");
  }
  if (state === "done") return <span className="restored">Restored</span>;
  return (
    <span className="restore">
      <button type="button" className="btn" onClick={go} disabled={state === "busy"}>{state === "busy" ? "Restoring" : "Restore"}</button>
      {error && <span className="error small" role="alert">{error}</span>}
    </span>
  );
}
