import { canRemove } from "./auth";
import { q } from "./db";
import { byName, displayName } from "./names";
import type { Session } from "./session";

export const EMOJI = ["❤️", "😂", "😍", "😢", "🙏", "👏"];

export type CommentView = { id: number; author: string; body: string; createdAt: string; canDelete: boolean };
export type ReactionView = { emoji: string; count: number; names: string[]; mine: boolean };

/** A photo's comments, oldest first, and its reactions in the fixed emoji order. */
export async function photoTalk(photoId: number, s: Session | null): Promise<{ comments: CommentView[]; reactions: ReactionView[] }> {
  const [comments, reactions] = await Promise.all([
    q<{ id: number; body: string; author_name: string | null; created_by_device: string | null; created_at: string }>(
      `select id, body, author_name, created_by_device, created_at from photo_comments where photo_id = $1 and deleted_at is null order by created_at, id`, [photoId]),
    q<{ emoji: string; created_by_device: string; author_name: string | null }>(
      `select emoji, created_by_device, author_name from photo_reactions where photo_id = $1 order by created_at`, [photoId]),
  ]);
  return {
    comments: comments.map((c) => ({ id: c.id, author: byName(c.author_name), body: c.body, createdAt: c.created_at, canDelete: canRemove(s, c.created_by_device) })),
    reactions: EMOJI.map((emoji) => {
      const rows = reactions.filter((r) => r.emoji === emoji);
      return { emoji, count: rows.length, names: rows.map((r) => (r.author_name ? displayName(r.author_name) : "Someone")), mine: rows.some((r) => r.created_by_device === s?.did) };
    }).filter((r) => r.count > 0),
  };
}

export async function addComment(photoId: number, body: string, s: Session) {
  const text = body.replace(/\r\n/g, "\n").trim().slice(0, 2000);
  if (!text) return null;
  const [row] = await q<{ id: number }>(
    `insert into photo_comments (photo_id, body, author_name, author_pid, created_by_device) values ($1, $2, $3, $4, $5) returning id`,
    [photoId, text, s.name, s.pid ?? null, s.did]);
  return row.id;
}
