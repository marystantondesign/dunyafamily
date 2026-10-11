"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { EmojiPicker } from "./EmojiPicker";
import { Icon } from "./Icon";

export type Reaction = { emoji: string; count: number; names: string[]; mine: boolean };
export type Comment = {
  id: number; author: string; body: string; createdAt: string; canDelete: boolean; parentId: number | null; replyTo: string | null;
  reactions: { emoji: string; count: number }[]; reactors: string[]; mine: string | null;
};

const EMOJI = ["❤️", "😂", "😍", "😢", "🙏", "👏"];
const LABEL: Record<string, string> = { "❤️": "Love", "😂": "Laughing", "😍": "Adore", "😢": "Sad", "🙏": "Grateful", "👏": "Applause" };

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : list.length === 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;

/** Emoji reactions under a photo. Tap one to add yours; tap it again to take it back. */
export function Reactions({ photoId, reactions, comments, onComments, countOnly }: {
  photoId: number; reactions: Reaction[]; comments: number; onComments?: () => void; countOnly?: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [full, setFull] = useState(false);
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

  const closeFull = useCallback(() => setFull(false), []);
  // Picking from the full panel always adds (or, if it's already yours, takes it back), then closes.
  const pickFull = useCallback((emoji: string) => { setFull(false); toggleRef.current(emoji); }, []);
  const toggleRef = useRef<(emoji: string) => void>(() => undefined);
  toggleRef.current = (emoji: string) => { toggle(emoji); };

  async function toggle(emoji: string) {
    setBusy(true);
    setPicking(false);
    setShown((prev) => {
      const r = prev.find((x) => x.emoji === emoji);
      if (r?.mine) return prev.map((x) => (x.emoji === emoji ? { ...x, count: x.count - 1, mine: false, names: x.names.slice(0, -1) } : x)).filter((x) => x.count > 0);
      if (r) return prev.map((x) => (x.emoji === emoji ? { ...x, count: x.count + 1, mine: true, names: [...x.names, "You"] } : x));
      return [...prev, { emoji, count: 1, mine: true, names: ["You"] }];
    });
    await fetch(`/api/photos/${photoId}/reactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) }).catch(() => undefined);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="talk-row">
      {shown.map((r) => (
        <button key={r.emoji} type="button" className={`react-chip${r.mine ? " mine" : ""}`} disabled={busy} onClick={() => toggle(r.emoji)}
          title={names(r.names)} aria-pressed={r.mine} aria-label={`${LABEL[r.emoji] ?? r.emoji}, ${r.count}: ${names(r.names)}${r.mine ? ". Tap to take yours back." : ""}`}>
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
            <button type="button" className="react-more" aria-label="More emoji" title="More emoji" onClick={() => { setPicking(false); setFull(true); }}>
              <Icon name="plus" size={18} stroke={2} />
            </button>
          </div>
        )}
        {full && (
          <>
            <div className="emoji-backdrop" onClick={() => setFull(false)} aria-hidden="true" />
            <EmojiPicker onPick={pickFull} onClose={closeFull} />
          </>
        )}
      </div>
      {countOnly ? <span className="talk-count">{comments ? `${comments} ${comments === 1 ? "comment" : "comments"}` : ""}</span>
        : onComments && (
          <button type="button" className="talk-comments" onClick={onComments}>
            <Icon name="comment" size={18} /> {comments ? `${comments} ${comments === 1 ? "comment" : "comments"}` : "Comment"}
          </button>
        )}
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

const QUICK = ["❤️", "😂", "😮", "😢", "🙏", "👍"];
/** What the Like button says once you've reacted. */
const DONE: Record<string, string> = { "❤️": "Loved", "😂": "Haha", "😮": "Wow", "😢": "Sad", "🙏": "Grateful", "👍": "Liked" };
const QUICK_LABEL: Record<string, string> = { "❤️": "Love", "😂": "Haha", "😮": "Wow", "😢": "Sad", "🙏": "Grateful", "👍": "Like" };
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

/** One comment: the bubble, its reactions, and Like, Reply, the time, and Delete. */
function CommentItem({ c, onReply, onError }: { c: Comment; onReply: (c: Comment) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const [mine, setMine] = useState(c.mine);
  const [counts, setCounts] = useState(c.reactions);
  useEffect(() => { setMine(c.mine); setCounts(c.reactions); }, [c.mine, c.reactions]);
  const [bar, setBar] = useState(false);
  // The quick reactions open below the comment, or above it when there's no room left in the list.
  const [up, setUp] = useState(false);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bar) return;
    const list = box.current?.closest(".cm-list"), r = box.current?.getBoundingClientRect();
    setUp(!!list && !!r && r.bottom + 64 > list.getBoundingClientRect().bottom);
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setBar(false); };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [bar]);

  async function react(emoji: string) {
    setBar(false);
    const next = mine === emoji ? null : emoji;
    setCounts((prev) => {
      let list = prev.map((r) => (r.emoji === mine ? { ...r, count: r.count - 1 } : r));
      if (next) list = list.some((r) => r.emoji === next) ? list.map((r) => (r.emoji === next ? { ...r, count: r.count + 1 } : r)) : [...list, { emoji: next, count: 1 }];
      return list.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
    });
    setMine(next);
    try { await send(`/api/comments/${c.id}/reactions`, { emoji }); } catch (e) { onError((e as Error).message); }
    router.refresh();
  }
  async function remove() {
    if (!confirm("Delete this comment? Mary can bring it back from Recently deleted.")) return;
    const res = await fetch(`/api/comments/${c.id}`, { method: "DELETE" });
    if (!res.ok) onError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
    router.refresh();
  }
  const total = counts.reduce((n, r) => n + r.count, 0);

  return (
    <div className={`cm${c.parentId ? " reply" : ""}`}>
      <Avatar name={c.author} small={!!c.parentId} />
      <div className="cm-main">
        <div className="cm-bubble">
          <p className="cm-author">{c.author}</p>
          <p className="cm-body">{c.replyTo && <span className="cm-mention">{c.replyTo} </span>}{c.body}</p>
          {total > 0 && (
            <span className="cm-badge" title={c.reactors.join(", ")} aria-label={`${total} ${total === 1 ? "reaction" : "reactions"}: ${c.reactors.join(", ")}`}>
              <span aria-hidden="true">{counts.slice(0, 3).map((r) => r.emoji).join("")}</span>{total > 1 && <span aria-hidden="true">{total}</span>}
            </span>
          )}
        </div>
        <div className="cm-actions" ref={box}>
          <button type="button" className={`cm-like${mine ? " on" : ""}`} aria-pressed={!!mine}
            onMouseEnter={() => { hover.current = setTimeout(() => setBar(true), 450); }}
            onMouseLeave={() => { if (hover.current) clearTimeout(hover.current); }}
            onTouchStart={() => { pressed.current = false; press.current = setTimeout(() => { pressed.current = true; setBar(true); }, 400); }}
            onTouchEnd={(e) => { if (press.current) clearTimeout(press.current); if (pressed.current) e.preventDefault(); }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => { if (hover.current) clearTimeout(hover.current); react(mine ?? "❤️"); }}>
            {mine ? DONE[mine] ?? "Reacted" : "Like"}
          </button>
          <button type="button" onClick={() => onReply(c)}>Reply</button>
          <time dateTime={c.createdAt} title={full(c.createdAt)}>{ago(c.createdAt)}</time>
          {c.canDelete && <button type="button" className="cm-delete" onClick={remove}>Delete</button>}
          {bar && (
            <div className={`cm-quick${up ? " up" : ""}`} role="menu" aria-label="React" onMouseLeave={() => setBar(false)}>
              {QUICK.map((e) => (
                <button key={e} type="button" role="menuitem" aria-label={QUICK_LABEL[e]} title={QUICK_LABEL[e]} className={mine === e ? "on" : undefined} onClick={() => react(e)}>{e}</button>
              ))}
            </div>
          )}
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
