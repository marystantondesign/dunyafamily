"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ReactionPicker } from "./ReactionPicker";

export type Reaction = { emoji: string; count: number; names: string[]; mine: boolean };
export type Comment = {
  id: number; author: string; body: string; createdAt: string; canDelete: boolean; parentId: number | null; replyTo: string | null;
  reactions: Reaction[];
};

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : list.length === 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;

/**
 * Emoji chips (emoji and count) and a "☺ +" button that opens the picker. Tap a chip to add yours or take it
 * back; people can add as many different emoji as they like. Used under the photo and under every comment.
 */
export function ReactionChips({ url, reactions, small, scope, label = "Add a reaction" }: {
  url: string; reactions: Reaction[]; small?: boolean; scope: string; label?: string;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  // Shown right away; the page catches up with everyone else's reactions on refresh.
  const [shown, setShown] = useState(reactions);
  useEffect(() => setShown(reactions), [reactions]);
  const addBtn = useRef<HTMLButtonElement>(null);

  async function toggle(emoji: string) {
    setShown((prev) => {
      const r = prev.find((x) => x.emoji === emoji);
      if (r?.mine) return prev.map((x) => (x.emoji === emoji ? { ...x, count: x.count - 1, mine: false, names: x.names.filter((n) => n !== "You") } : x)).filter((x) => x.count > 0);
      if (r) return prev.map((x) => (x.emoji === emoji ? { ...x, count: x.count + 1, mine: true, names: [...x.names, "You"] } : x));
      return [...prev, { emoji, count: 1, mine: true, names: ["You"] }];
    });
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) }).catch(() => undefined);
    router.refresh();
  }

  return (
    <>
      {shown.map((r) => (
        <button key={r.emoji} type="button" className={`react-chip${small ? " small" : ""}${r.mine ? " mine" : ""}`} onClick={() => toggle(r.emoji)}
          title={names(r.names)} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.count}: ${names(r.names)}${r.mine ? ". Tap to take yours back." : ""}`}>
          <span aria-hidden="true">{r.emoji}</span> {r.count}
        </button>
      ))}
      <button ref={addBtn} type="button" className={`react-chip add${small ? " small" : ""}${picking ? " open" : ""}`} aria-label={label} aria-haspopup="dialog" aria-expanded={picking}
        onClick={() => setPicking(!picking)}>
        <Icon name="smile" size={small ? 15 : 18} /><Icon name="plus" size={small ? 10 : 12} stroke={2.4} />
      </button>
      {picking && addBtn.current && (
        <ReactionPicker anchor={addBtn.current} within={addBtn.current.closest<HTMLElement>(scope)} mine={shown.filter((r) => r.mine).map((r) => r.emoji)}
          onPick={(e) => { if (!shown.some((r) => r.emoji === e && r.mine)) toggle(e); }} onClose={() => setPicking(false)} />
      )}
    </>
  );
}

/** Emoji reactions under a photo. */
export function Reactions({ photoId, reactions }: { photoId: number; reactions: Reaction[] }) {
  return (
    <div className="talk-row">
      <ReactionChips url={`/api/photos/${photoId}/reactions`} reactions={reactions} scope=".pv-main" />
    </div>
  );
}

/** "now", "45m", "2h", "3d", then the date. */
function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
}
const full = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const SHOWN_REPLIES = 2;

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";
/** A warm tint per person, so avatars are easy to tell apart. */
const TINTS = ["#B39A80", "#9C8670", "#C4B095", "#A88B7A", "#B9A58C", "#8F7B68"];
const tint = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
function Avatar({ name, small }: { name: string; small?: boolean }) {
  return <span className={`comment-avatar${small ? " small" : ""}`} style={{ background: tint(name) }} aria-hidden="true">{initial(name)}</span>;
}

async function send(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't post. Try again.");
}

/** One comment: the bubble, then its reactions, Reply, the time, and Delete. */
function CommentItem({ c, onReply, onError }: { c: Comment; onReply: (c: Comment) => void; onError: (m: string) => void }) {
  const router = useRouter();
  async function remove() {
    if (!confirm("Delete this comment? Mary can bring it back from Recently deleted.")) return;
    const res = await fetch(`/api/comments/${c.id}`, { method: "DELETE" });
    if (!res.ok) onError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
    router.refresh();
  }
  return (
    <div className={`cm${c.parentId ? " reply" : ""}`}>
      <Avatar name={c.author} small={!!c.parentId} />
      <div className="cm-main">
        <div className="cm-bubble">
          <p className="cm-author">{c.author}</p>
          <p className="cm-body">{c.replyTo && <span className="cm-mention">{c.replyTo} </span>}{c.body}</p>
        </div>
        <div className="cm-actions">
          <ReactionChips small url={`/api/comments/${c.id}/reactions`} reactions={c.reactions} scope=".pv-talk, .pv-talksheet" label={`React to ${c.author}'s comment`} />
          <button type="button" className="cm-reply" onClick={() => onReply(c)}>Reply</button>
          <time dateTime={c.createdAt} title={full(c.createdAt)}>{ago(c.createdAt)}</time>
          {c.canDelete && <button type="button" className="cm-delete" onClick={remove}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

/** A box to write in, with a round send button. Enter sends; Shift-Enter starts a new line. */
function Composer({ me, placeholder, mention, onSend, autoFocus, onCancel, small }: {
  me: string; placeholder: string; mention?: string; onSend: (text: string) => Promise<boolean>; autoFocus?: boolean; onCancel?: () => void; small?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (autoFocus) area.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);
  async function go(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await onSend(text)) setText("");
    setBusy(false);
  }
  return (
    <form className={`cm-compose${small ? " small" : ""}`} onSubmit={go}>
      <Avatar name={me} small={small} />
      <div className="cm-field" onClick={() => area.current?.focus()}>
        {mention && <span className="cm-mention">{mention}</span>}
        <label className="sr-only" htmlFor={`cm-${placeholder}-${mention ?? ""}`}>{mention ? `Reply to ${mention}` : "Write a comment"}</label>
        <textarea id={`cm-${placeholder}-${mention ?? ""}`} ref={area} rows={1} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); }
            if (e.key === "Escape" && onCancel) { e.stopPropagation(); onCancel(); }
          }} />
        <button type="submit" className="cm-send" aria-label={busy ? "Posting" : "Post"} disabled={busy || !text.trim()}><Icon name="arrowRight" size={16} stroke={2.2} /></button>
      </div>
    </form>
  );
}

/** Everyone's comments with replies under them, oldest first, and a box at the bottom to add yours. */
export function Thread({ photoId, comments, me, compose = "Share a memory, or who else was there", focus }: {
  photoId: number; comments: Comment[]; me: string; compose?: string; focus?: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState<Comment | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const count = useRef(comments.length);
  useEffect(() => {
    // Scroll to the newest after posting a new top comment.
    if (comments.length > count.current && !replying) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
    count.current = comments.length;
  }, [comments.length, replying]);

  const tops = comments.filter((c) => !c.parentId);
  const repliesTo = (id: number) => comments.filter((c) => c.parentId === id);

  async function post(text: string, replyTo?: number) {
    setError("");
    try { await send(`/api/photos/${photoId}/comments`, { body: text, replyTo }); }
    catch (e) { setError((e as Error).message); return false; }
    if (replyTo) {
      const top = comments.find((c) => c.id === replyTo);
      setOpen((o) => new Set(o).add(top?.parentId ?? replyTo));
      setReplying(null);
    }
    router.refresh();
    return true;
  }

  return (
    <div className="cm-thread">
      <div className="cm-list" ref={list}>
        {tops.length === 0 && <p className="muted cm-none">No comments yet. Share a memory about this photo.</p>}
        {tops.map((c) => {
          const replies = repliesTo(c.id);
          const shown = open.has(c.id) ? replies : replies.slice(0, SHOWN_REPLIES);
          const replyHere = replying && (replying.id === c.id || replying.parentId === c.id);
          return (
            <div key={c.id} className="cm-group">
              <CommentItem c={c} onReply={setReplying} onError={setError} />
              {(replies.length > 0 || replyHere) && (
                <div className="cm-replies">
                  {shown.map((r) => <CommentItem key={r.id} c={r} onReply={setReplying} onError={setError} />)}
                  {replies.length > shown.length && (
                    <button type="button" className="cm-more" onClick={() => setOpen((o) => new Set(o).add(c.id))}>
                      <span aria-hidden="true">↳</span> View {replies.length - shown.length} more {replies.length - shown.length === 1 ? "reply" : "replies"}
                    </button>
                  )}
                  {replyHere && (
                    <Composer key={replying.id} small me={me} mention={replying.author} placeholder="Write a reply" autoFocus
                      onCancel={() => setReplying(null)} onSend={(t) => post(t, replying.id)} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="error cm-error" role="alert">{error}</p>}
      <Composer me={me} placeholder={compose} autoFocus={focus} onSend={(t) => post(t)} />
    </div>
  );
}
