"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/** Make a submitted story into a draft (the sender kept as its credit), or delete it. */
export function SubmissionActions({ id, draftId }: { id: number; draftId: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  async function call(method: "POST" | "DELETE") {
    setBusy(true); setError("");
    const res = await fetch(`/api/stories/submit/${id}`, { method });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); setError(out.error ?? "That didn't work. Try again."); return; }
    router.push(method === "POST" ? `/admin/stories/${out.id}` : "/admin/stories?tab=submitted");
    router.refresh();
  }
  return (
    <div className="sd-actions">
      {draftId
        ? <Link href={`/admin/stories/${draftId}`} className="btn btn-primary">Open the draft</Link>
        : <button type="button" className="btn btn-primary" disabled={busy} onClick={() => call("POST")}>Make it a draft</button>}
      <button type="button" className="btn sd-delete" disabled={busy} onClick={() => setConfirming(true)}>Delete</button>
      {error && <p className="error" role="alert">{error}</p>}
      {confirming && (
        <ConfirmDialog title="Delete this story?" body="It comes off your Submitted list. The person who sent it won't be told."
          keep="Keep it" confirm="Delete" onKeep={() => setConfirming(false)} onConfirm={() => { setConfirming(false); call("DELETE"); }} />
      )}
    </div>
  );
}
