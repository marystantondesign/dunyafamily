import { canRemove } from "./auth";
import { q } from "./db";
import { byName, displayName } from "./names";
import type { Session } from "./session";

/** The quick picks. Any other emoji works too. */
export const EMOJI = ["❤️", "😂", "😍", "😢", "🙏", "👏"];

/** One emoji, including skin tones, flags, keycaps, and joined ones like 👨‍👩‍👧. Nothing else. */
export function isEmoji(text: string) {
  const t = text.trim();
  if (!t || t.length > 32) return false;
  const parts = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(t)];
  return parts.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(t);
}

export type CommentView = {
  id: number; author: string; body: string; createdAt: string; canDelete: boolean;
  parentId: number | null; replyTo: string | null;
  // Reactions on the comment: each emoji's count (most used first), who reacted, and this device's pick.
  reactions: { emoji: string; count: number }[]; reactors: string[]; mine: string | null;
};
export type ReactionView = { emoji: string; count: number; names: string[]; mine: boolean };

/**
 * A photo's comments, oldest first, and its reactions in the order each emoji was first used. Replies come
 * back flat with their parentId; replies under a deleted comment are left out (they return if it's restored).
 */
export async function photoTalk(photoId: number, s: Session | null): Promise<{ comments: CommentView[]; reactions: ReactionView[] }> {
  const [comments, reactions, cr] = await Promise.all([
    q<{ id: number; body: string; author_name: string | null; created_by_device: string | null; created_at: string; parent_id: number | null; reply_to_name: string | null }>(
      `select id, body, author_name, created_by_device, created_at, parent_id, reply_to_name from photo_comments
        where photo_id = $1 and deleted_at is null order by created_at, id`, [photoId]),
    q<{ emoji: string; created_by_device: string; author_name: string | null }>(
      `select emoji, created_by_device, author_name from photo_reactions where photo_id = $1 order by created_at`, [photoId]),
    q<{ comment_id: number; emoji: string; created_by_device: string; author_name: string | null }>(
      `select r.comment_id, r.emoji, r.created_by_device, r.author_name from comment_reactions r
         join photo_comments c on c.id = r.comment_id where c.photo_id = $1 order by r.created_at`, [photoId]),
  ]);
  const live = new Set(comments.filter((c) => !c.parent_id).map((c) => c.id));
  return {
    comments: comments.filter((c) => !c.parent_id || live.has(c.parent_id)).map((c) => {
      const mine = cr.filter((r) => r.comment_id === c.id);
      const counts = [...new Set(mine.map((r) => r.emoji))].map((emoji) => ({ emoji, count: mine.filter((r) => r.emoji === emoji).length }))
        .sort((a, b) => b.count - a.count);
      return {
        id: c.id, author: byName(c.author_name), body: c.body, createdAt: c.created_at, canDelete: canRemove(s, c.created_by_device),
        parentId: c.parent_id, replyTo: c.reply_to_name ? displayName(c.reply_to_name) : null,
        reactions: counts, reactors: mine.map((r) => (r.author_name ? displayName(r.author_name) : "Someone")),
        mine: mine.find((r) => r.created_by_device === s?.did)?.emoji ?? null,
      };
    }),
    reactions: [...new Set(reactions.map((r) => r.emoji))].map((emoji) => {
      const rows = reactions.filter((r) => r.emoji === emoji);
      return { emoji, count: rows.length, names: rows.map((r) => (r.author_name ? displayName(r.author_name) : "Someone")), mine: rows.some((r) => r.created_by_device === s?.did) };
    }),
  };
}

/** Add a comment, or a reply. A reply to a reply goes under the same top comment and names who it answers. */
export async function addComment(photoId: number, body: string, s: Session, replyTo?: number | null): Promise<number | string> {
  const text = body.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!text) return "Write something first.";
  let parent: number | null = null, name: string | null = null;
  if (replyTo) {
    const [c] = await q<{ id: number; parent_id: number | null; author_name: string | null }>(
      `select id, parent_id, author_name from photo_comments where id = $1 and photo_id = $2 and deleted_at is null`, [replyTo, photoId]);
    if (!c) return "That comment isn't here anymore.";
    parent = c.parent_id ?? c.id;
    name = c.author_name;
  }
  const [row] = await q<{ id: number }>(
    `insert into photo_comments (photo_id, body, author_name, author_pid, created_by_device, parent_id, reply_to_name) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [photoId, text, s.name, s.pid ?? null, s.did, parent, name]);
  return row.id;
}

/** React to a comment. The same emoji again takes it back; a different one replaces it. */
export async function reactToComment(commentId: number, emoji: string, s: Session) {
  const gone = await q(`delete from comment_reactions where comment_id = $1 and created_by_device = $2 and emoji = $3 returning 1`, [commentId, s.did, emoji]);
  if (gone.length) return false;
  await q(`insert into comment_reactions (comment_id, emoji, created_by_device, author_name, author_pid) values ($1, $2, $3, $4, $5)
           on conflict (comment_id, created_by_device) do update set emoji = excluded.emoji, author_name = excluded.author_name, created_at = now()`,
    [commentId, emoji, s.did, s.name, s.pid ?? null]);
  return true;
}
