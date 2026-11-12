"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Row = {
  id: number; photoId: number; kind: string; label: string; note: string | null; status: string; at: string; decidedAt: string | null;
  name: string; url: string | null; photoGone: boolean;
};
const OUTCOME: Record<string, string> = { removed: "Photo removed", untagged: "Tag removed", kept: "Photo kept" };

function When({ iso }: { iso: string }) {
  const [t, setT] = useState("");
  useEffect(() => { setT(new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })); }, [iso]);
  return <>{t}</>;
}

/** Mary's removal requests: the photo, who asked, what they chose, their note, and the three decisions. */
export function RemovalQueue({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const waiting = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  async function decide(r: Row, action: "remove" | "untag" | "keep") {
    const ask = action === "remove" ? `Remove this photo from the site? It goes to Recently deleted for 30 days.`
      : action === "untag" ? `Remove ${r.name}'s tag from this photo?` : null;
    if (ask && !window.confirm(ask)) return;
    setBusy(r.id); setError("");
    const res = await fetch(`/api/removals/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
    setBusy(null);
    router.refresh();
  }

  const card = (r: Row, open: boolean) => (
    <article key={r.id} className="rq-card">
      {r.url
        ? (r.photoGone ? <img className="rq-photo" src={r.url} alt="" /> : <Link href={`/photos/${r.photoId}`}><img className="rq-photo" src={r.url} alt={`Photo ${r.photoId}`} /></Link>) // eslint-disable-line @next/next/no-img-element
        : <span className="rq-photo" />}
      <div className="rq-text">
        <p className="rq-meta"><strong>{r.name}</strong> · <When iso={r.at} /></p>
        <p className="rq-choice">{r.label}</p>
        {r.note && <p className="rq-note">{r.note}</p>}
        {open ? (
          <div className="rq-actions">
            <button type="button" className="btn btn-primary" disabled={busy === r.id} onClick={() => decide(r, "remove")}>Remove photo</button>
            <button type="button" className="btn" disabled={busy === r.id} onClick={() => decide(r, "untag")}>Remove tag</button>
            <button type="button" className="btn" disabled={busy === r.id} onClick={() => decide(r, "keep")}>Keep photo</button>
          </div>
        ) : <p className="rq-outcome">{OUTCOME[r.status] ?? r.status}{r.decidedAt && <> · <When iso={r.decidedAt} /></>}</p>}
      </div>
    </article>
  );

  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      {waiting.length ? <div className="rq-list">{waiting.map((r) => card(r, true))}</div> : <p className="ms-empty">No requests waiting.</p>}
      {decided.length > 0 && (
        <section className="rq-done">
          <h2>Decided</h2>
          <div className="rq-list">{decided.map((r) => card(r, false))}</div>
        </section>
      )}
    </>
  );
}
