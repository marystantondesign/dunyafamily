import { canRemove } from "./auth";
import { q } from "./db";
import { byName, displayName } from "./names";
import { signGet } from "./r2";
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
  id: number; author: string; body: string; createdAt: string; editedAt: string | null; canDelete: boolean;
  parentId: number | null; replyTo: string | null;
  /** A comment that was deleted but still has replies: it shows as "This comment was removed" so the replies keep their place. */
  removed: boolean;
  // Reactions on the comment, in the order each emoji was first used, like the photo's.
  reactions: ReactionView[];
  avatarUrl: string | null;
};
export type ReactionView = { emoji: string; count: number; names: string[]; mine: boolean };

/**
 * A photo's comments, oldest first, and its reactions in the order each emoji was first used. Replies come
 * back flat with their parentId; replies under a deleted comment are left out (they return if it's restored).
 */
export async function photoTalk(photoId: number, s: Session | null): Promise<{ comments: CommentView[]; reactions: ReactionView[] }> {
  const [comments, reactions, cr] = await Promise.all([
    q<{ id: number; body: string; author_name: string | null; created_by_device: string | null; created_at: string; edited_at: string | null;
      parent_id: number | null; reply_to_name: string | null; deleted_at: string | null; pe_name: string | null; thumb_key: string | null }>(
      // The author's person record gives their current name and profile photo.
      `select c.id, c.body, c.author_name, c.created_by_device, c.created_at, c.edited_at, c.parent_id, c.reply_to_name, c.deleted_at,
              pe.name as pe_name, ph.thumb_key
         from photo_comments c
         left join people pe on pe.id = c.author_pid and pe.deleted_at is null
         left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
        where c.photo_id = $1 and (c.deleted_at is null or (c.parent_id is null and exists (
          select 1 from photo_comments r where r.parent_id = c.id and r.deleted_at is null)))
        order by c.created_at, c.id`, [photoId]),
    q<{ emoji: string; created_by_device: string; author_name: string | null }>(
      `select emoji, created_by_device, author_name from photo_reactions where photo_id = $1 order by created_at`, [photoId]),
    q<{ comment_id: number; emoji: string; person_id: number | null; device: string | null; name: string | null; person_name: string | null }>(
      `select r.comment_id, r.emoji, r.person_id, r.device, r.name, pe.name as person_name from comment_emoji r
         join photo_comments c on c.id = r.comment_id left join people pe on pe.id = r.person_id
        where c.photo_id = $1 order by r.created_at, r.id`, [photoId]),
  ]);
  const thumbs = new Map(await Promise.all(comments.filter((c) => c.thumb_key && !c.deleted_at).map(async (c) => [c.id, await signGet(c.thumb_key!)] as const)));
  const live = new Set(comments.filter((c) => !c.parent_id).map((c) => c.id));
  const shown = comments.filter((c) => !c.parent_id || live.has(c.parent_id));
  return {
    comments: shown.map((c) => {
      const rows = cr.filter((r) => r.comment_id === c.id);
      const isMe = (r: (typeof rows)[number]) => (r.person_id != null ? r.person_id === s?.pid : !!s && r.device === s.did);
      return {
        id: c.id, author: c.deleted_at ? "" : byName(c.pe_name ?? c.author_name), avatarUrl: thumbs.get(c.id) ?? null, body: c.deleted_at ? "" : c.body, createdAt: c.created_at, editedAt: c.edited_at,
        canDelete: !c.deleted_at && canRemove(s, c.created_by_device), removed: !!c.deleted_at,
        parentId: c.parent_id, replyTo: c.reply_to_name ? displayName(c.reply_to_name) : null,
        reactions: [...new Set(rows.map((r) => r.emoji))].map((emoji) => {
          const these = rows.filter((r) => r.emoji === emoji);
          return { emoji, count: these.length, names: these.map((r) => displayName(r.person_name ?? r.name ?? "Someone")), mine: these.some(isMe) };
        }),
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

/** React to a comment. The same emoji again takes it back; people can add as many different ones as they like. */
export async function reactToComment(commentId: number, emoji: string, s: Session) {
  const who = s.pid ? `person_id = $3` : `person_id is null and device = $3`;
  const gone = await q(`delete from comment_emoji where comment_id = $1 and emoji = $2 and ${who} returning 1`, [commentId, emoji, s.pid ?? s.did]);
  if (gone.length) return false;
  await q(`insert into comment_emoji (comment_id, emoji, person_id, device, name) values ($1, $2, $3, $4, $5) on conflict do nothing`,
    [commentId, emoji, s.pid ?? null, s.did, s.name]);
  return true;
}

/** Change what a comment says. Whoever wrote it, or Mary. The posted time stays; edited_at records the change. */
export async function editComment(id: number, body: string): Promise<string | null> {
  const text = body.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!text) return "Write something, or delete the comment instead.";
  await q(`update photo_comments set body = $2, edited_at = now() where id = $1 and deleted_at is null`, [id, text]);
  return null;
}

/** The emoji the family has used most recently, on photos and comments, newest first. */
export async function recentEmoji(limit = 16): Promise<string[]> {
  const rows = await q<{ emoji: string }>(
    `select emoji from (
       select emoji, max(created_at) as at from (
         select emoji, created_at from photo_reactions
         union all select emoji, created_at from comment_emoji) x
       group by emoji) y
     order by at desc limit $1`, [limit]);
  return rows.map((r) => r.emoji);
}
