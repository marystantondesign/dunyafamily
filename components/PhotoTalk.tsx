"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export type Reaction = { emoji: string; count: number; names: string[]; mine: boolean };
export type Comment = { id: number; author: string; body: string; createdAt: string; canDelete: boolean };

const EMOJI = ["❤️", "😂", "😍", "😢", "🙏", "👏"];
const LABEL: Record<string, string> = { "❤️": "Love", "😂": "Laughing", "😍": "Adore", "😢": "Sad", "🙏": "Grateful", "👏": "Applause" };

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : list.length === 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;

/** Emoji reactions under a photo. Tap one to add yours; tap it again to take it back. */
export function Reactions({ photoId, reactions, comments, onComments }: {
  photoId: number; reactions: Reaction[]; comments: number; onComments: () => void;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  // Shown right away; the page catches up with everyone else's reactions on refresh.
  const [shown, setShown] = useState(reactions);
  useEffect(() => setShown(reactions), [reactions]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!picking) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setPicking(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [picking]);

  async function toggle(emoji: string) {
    setBusy(true);
    setPicking(false);
    setShown((prev) => {
      const r = prev.find((x) => x.emoji === emoji);
      if (r?.mine) return prev.map((x) => (x.emoji === emoji ? { ...x, count: x.count - 1, mine: false, names: x.names.slice(0, -1) } : x)).filter((x) => x.count > 0);
      if (r) return prev.map((x) => (x.emoji === emoji ? { ...x, count: x.count + 1, mine: true, names: [...x.names, "You"] } : x));
      return [...prev, { emoji, count: 1, mine: true, names: ["You"] }].sort((a, b) => EMOJI.indexOf(a.emoji) - EMOJI.indexOf(b.emoji));
    });
    await fetch(`/api/photos/${photoId}/reactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) }).catch(() => undefined);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="talk-row">
      {shown.map((r) => (
        <button key={r.emoji} type="button" className={`react-chip${r.mine ? " mine" : ""}`} disabled={busy} onClick={() => toggle(r.emoji)}
          title={names(r.names)} aria-pressed={r.mine} aria-label={`${LABEL[r.emoji]}, ${r.count}: ${names(r.names)}${r.mine ? ". Tap to take yours back." : ""}`}>
          <span aria-hidden="true">{r.emoji}</span> {r.count}
        </button>
      ))}
      <div className="react-add" ref={box}>
        <button type="button" className="react-chip add" aria-label="Add a reaction" aria-expanded={picking} onClick={() => setPicking(!picking)}>
          <Icon name="smile" size={18} /><Icon name="plus" size={12} stroke={2.4} />
        </button>
        {picking && (
          <div className="react-palette" role="menu">
            {EMOJI.map((e) => (
              <button key={e} type="button" role="menuitem" aria-label={LABEL[e]} title={LABEL[e]} onClick={() => toggle(e)}
                className={shown.some((r) => r.emoji === e && r.mine) ? "mine" : undefined}>{e}</button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="talk-comments" onClick={onComments}>
        <Icon name="comment" size={18} /> {comments ? `${comments} ${comments === 1 ? "comment" : "comments"}` : "Comment"}
      </button>
    </div>
  );
}

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** The comments panel: everyone's comments, oldest first, and a box to add yours. */
export function Comments({ photoId, comments, onClose }: { photoId: number; comments: Comment[]; onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [comments.length]);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/photos/${photoId}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    if (res.ok) { setText(""); router.refresh(); } else setError((await res.json().catch(() => ({}))).error ?? "That didn't post. Try again.");
    setBusy(false);
  }
  async function remove(id: number) {
    if (!confirm("Delete this comment? Mary can bring it back from Recently deleted.")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
    router.refresh();
  }

  return (
    <div className="pd comments">
      <div className="pd-head">
        <h2>Comments</h2>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      {comments.length ? (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id}>
              <span className="comment-avatar" aria-hidden="true">{c.author.charAt(0).toUpperCase()}</span>
              <div>
                <p className="comment-meta"><strong>{c.author}</strong> <span>{ago(c.createdAt)}</span></p>
                <p className="comment-body">{c.body}</p>
                {c.canDelete && <button type="button" className="text-btn quiet small" onClick={() => remove(c.id)}>Delete</button>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="muted">No comments yet. Share a memory about this photo.</p>}
      <div ref={end} />
      <form className="comment-form" onSubmit={post}>
        <label htmlFor="comment-text" className="sr-only">Write a comment</label>
        <textarea id="comment-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share a memory, or who else was there"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(e); }} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !text.trim()}>{busy ? "Posting" : "Post"}</button>
      </form>
    </div>
  );
}
