"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { StoryFace } from "./StoriesIndex";

type Row = { id: number; name: string; inMemory: boolean; avatarUrl: string | null; at: string };

/** Day and time in the viewer's own time zone (worked out in the browser). */
function useWhen(iso: string) {
  const [w, setW] = useState<{ day: string; time: string } | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    setW({ day: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) });
  }, [iso]);
  return w;
}

function Person({ r, onRemove, busy }: { r: Row; onRemove: () => void; busy: boolean }) {
  const w = useWhen(r.at);
  return (
    <li className="bi-row">
      <span className="bi-name"><StoryFace p={r} size={36} /><span className="bi-text"><strong>{r.name}</strong><span className="bi-when phone-only">{w ? `${w.day} at ${w.time}` : ""}</span></span></span>
      <span className="bi-day desktop-only">{w?.day ?? ""}</span>
      <span className="bi-time desktop-only">{w?.time ?? ""}</span>
      <button type="button" className="bi-remove" aria-label={`Take ${r.name} off the list`} title="Take off the list" disabled={busy} onClick={onRemove}><Icon name="x" size={16} stroke={2} /></button>
    </li>
  );
}

/** The summary card and the list. Mary can take someone off (they see the button again). */
export function BookInterest({ list }: { list: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(list);
  const [busy, setBusy] = useState<number | null>(null);
  async function remove(r: Row) {
    if (!window.confirm(`Take ${r.name} off the list? They'll see "I'd want a copy" again.`)) return;
    setBusy(r.id);
    const res = await fetch("/api/stories/book", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ personId: r.id }) });
    if (res.ok) { setRows((cur) => cur.filter((x) => x.id !== r.id)); router.refresh(); }
    setBusy(null);
  }
  const n = rows.length;
  return (
    <>
      <div className="bi-summary">
        <Icon name="book" size={24} />
        <div>
          <p className="bi-count">{n === 1 ? "1 person wants a copy" : `${n} people want a copy`}</p>
          {n > 0 && <p className="bi-sub">Newest first</p>}
        </div>
      </div>
      {n ? (
        <div className="bi-table">
          <div className="bi-headrow desktop-only" aria-hidden="true"><span>Name</span><span>Day</span><span>Time</span><span /></div>
          <ul>{rows.map((r) => <Person key={r.id} r={r} busy={busy === r.id} onRemove={() => remove(r)} />)}</ul>
        </div>
      ) : <p className="ms-empty">No one has asked for a copy yet.</p>}
    </>
  );
}
