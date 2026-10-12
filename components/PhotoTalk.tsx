"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { ReactionPicker } from "./ReactionPicker";

export type Reaction = { emoji: string; count: number; names: string[]; mine: boolean };
export type Comment = {
  id: number; author: string; body: string; createdAt: string; editedAt: string | null; canDelete: boolean;
  parentId: number | null; replyTo: string | null; removed: boolean; reactions: Reaction[];
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

/** "Just now", "45m", "2h", "3d", then the date. */
function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
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
const FRESH_MS = 2200;

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";
/** A warm tint per person, so avatars are easy to tell apart. */
const TINTS = ["#B39A80", "#9C8670", "#C4B095", "#A88B7A", "#B9A58C", "#8F7B68"];
const tint = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
function Avatar({ name, small }: { name: string; small?: boolean }) {
  return <span className={`comment-avatar${small ? " small" : ""}`} style={{ background: tint(name) }} aria-hidden="true">{initial(name)}</span>;
}

async function send(url: string, body: unknown, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "That didn't post. Try again.");
  return data as { id?: number };
}

/** One comment: the bubble (name, time, text), then its reactions, ☺ +, Reply, and Edit and Delete for your own. */
function CommentItem({ c, fresh, onReply, onError }: { c: Comment; fresh: boolean; onReply: (c: Comment) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = area.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft, editing]);

  if (c.removed) {
    return (
      <div className="cm removed">
        <span className="comment-avatar" aria-hidden="true" />
        <div className="cm-main"><div className="cm-bubble"><p className="cm-body">This comment was removed</p></div></div>
      </div>
    );
  }

  async function remove() {
    if (!confirm("Delete this comment? Mary can bring it back from Recently deleted.")) return;
    const res = await fetch(`/api/comments/${c.id}`, { method: "DELETE" });
    if (!res.ok) onError((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
    router.refresh();
  }
  async function save() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try { await send(`/api/comments/${c.id}`, { body: draft }, "PATCH"); setEditing(false); router.refresh(); }
    catch (e) { onError((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className={`cm${c.parentId ? " reply" : ""}${fresh ? " fresh" : ""}`} data-comment={c.id}>
      <Avatar name={c.author} small={!!c.parentId} />
      <div className="cm-main">
        <div className={`cm-bubble${editing ? " editing" : ""}`}>
          <p className="cm-author">
            {c.author} <span className="cm-when">· <time dateTime={c.createdAt} title={full(c.createdAt)} suppressHydrationWarning>{ago(c.createdAt)}</time>{c.editedAt && " · edited"}</span>
          </p>
          {editing ? (
            <div className="cm-edit">
              <label className="sr-only" htmlFor={`cm-edit-${c.id}`}>Edit your comment</label>
              <textarea id={`cm-edit-${c.id}`} ref={area} rows={2} value={draft} autoFocus onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); save(); }
                  if (e.key === "Escape") { e.stopPropagation(); setEditing(false); setDraft(c.body); }
                }} />
              <div className="cm-edit-actions">
                <button type="button" className="btn" onClick={() => { setEditing(false); setDraft(c.body); }}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy || !draft.trim()} onClick={save}>{busy ? "Saving" : "Save"}</button>
              </div>
            </div>
          ) : (
            <p className="cm-body">{c.replyTo && <span className="cm-mention">{c.replyTo} </span>}{c.body}</p>
          )}
        </div>
        {!editing && (
          <div className="cm-actions">
            <ReactionChips small url={`/api/comments/${c.id}/reactions`} reactions={c.reactions} scope=".pv-talk, .pv-talksheet" label={`React to ${c.author}'s comment`} />
            <button type="button" className="cm-reply" onClick={() => onReply(c)}>Reply</button>
            {c.canDelete && <button type="button" className="cm-edit-btn" onClick={() => { setDraft(c.body); setEditing(true); }}>Edit</button>}
            {c.canDelete && <button type="button" className="cm-delete" onClick={remove}>Delete</button>}
          </div>
        )}
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
    // Posted: clear the box and put the keyboard away so the new comment is in view.
    if (await onSend(text)) { setText(""); area.current?.blur(); }
    setBusy(false);
  }
  return (
    <form className={`cm-compose${small ? " small" : ""}`} onSubmit={go}>
      <Avatar name={me} small={small} />
      <div className="cm-field" onClick={() => area.current?.focus()}>
        {mention && <span className="cm-mention">{mention}</span>}
        <label className="sr-only" htmlFor={`cm-${placeholder}-${mention ?? ""}`}>{mention ? `Reply to ${mention}` : "Write a comment"}</label>
        <textarea id={`cm-${placeholder}-${mention ?? ""}`} ref={area} rows={1} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)}
          enterKeyHint="send"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); go(); }
            if (e.key === "Escape" && onCancel) { e.stopPropagation(); onCancel(); }
          }} />
        <button type="submit" className="cm-send" aria-label={busy ? "Posting" : "Post"} disabled={busy || !text.trim()}><Icon name="arrowRight" size={16} stroke={2.2} /></button>
      </div>
    </form>
  );
}

/**
 * Everyone's comments with replies under them, oldest first, and a box at the bottom to add yours. After posting,
 * the new comment scrolls into view with a soft gold highlight, and "Comment posted" shows above the box.
 */
export function Thread({ photoId, comments, me, compose = "Share a memory, or who else was there", focus }: {
  photoId: number; comments: Comment[]; me: string; compose?: string; focus?: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState<Comment | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<number | null>(null);
  const [toast, setToast] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  // Once the page has the new comment, bring it into view and let the highlight fade.
  useEffect(() => {
    if (fresh === null) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-comment="${fresh}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const t = setTimeout(() => { setFresh(null); setToast(false); }, FRESH_MS);
    return () => clearTimeout(t);
  }, [fresh, comments]);

  const tops = comments.filter((c) => !c.parentId);
  const repliesTo = (id: number) => comments.filter((c) => c.parentId === id);

  async function post(text: string, replyTo?: number) {
    setError("");
    let id: number | undefined;
    try { id = (await send(`/api/photos/${photoId}/comments`, { body: text, replyTo })).id; }
    catch (e) { setError((e as Error).message); return false; }
    if (replyTo) {
      const top = comments.find((c) => c.id === replyTo);
      setOpen((o) => new Set(o).add(top?.parentId ?? replyTo));
      setReplying(null);
    }
    if (id) setFresh(id);
    setToast(true);
    router.refresh();
    return true;
  }

  const item = (c: Comment) => <CommentItem key={c.id} c={c} fresh={c.id === fresh} onReply={setReplying} onError={setError} />;
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
              {item(c)}
              {(replies.length > 0 || replyHere) && (
                <div className="cm-replies">
                  {shown.map(item)}
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
      <div className="cm-toast-slot" aria-live="polite">{toast && <span className="cm-toast"><Icon name="check" size={14} stroke={2.4} /> Comment posted</span>}</div>
      <Composer me={me} placeholder={compose} autoFocus={focus} onSend={(t) => post(t)} />
    </div>
  );
}
