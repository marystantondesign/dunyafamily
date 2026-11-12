import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { SUB_KEY } from "@/lib/submissions";

/** Send a story to Mary. It isn't posted anywhere, and it can't be edited afterward. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Pick yourself first.");
  const b = (await req.json().catch(() => ({}))) as { about?: number[]; title?: string; body?: string; photos?: { key: string; thumbKey: string }[]; photoIds?: number[] };
  const body = String(b.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, 100_000);
  if (!body) return badRequest("Write the story before sending it.");
  const photos = (b.photos ?? []).slice(0, 10).filter((p) => SUB_KEY.test(p.key) && SUB_KEY.test(p.thumbKey));
  // Archive photos are linked by id: only ones still on the site and not hidden from the sender.
  const askedIds = [...new Set((b.photoIds ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 10);
  const okIds = askedIds.length ? (await q<{ id: number }>(
    `select p.id from photos p where p.id = any($1::int[]) and p.deleted_at is null
       and not exists (select 1 from photo_hidden h where h.photo_id = p.id and h.person_id = $2)`, [askedIds, s.pid])).map((r) => r.id) : [];
  const photoIds = askedIds.filter((id) => okIds.includes(id));
  const wanted = [...new Set((b.about ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const about = wanted.length ? (await q<{ id: number }>(`select id from people where id = any($1::int[]) and deleted_at is null`, [wanted])).map((r) => r.id) : [];
  await q(
    `insert into story_submissions (person_id, submitted_by_name, about, title, body, photo_keys, thumb_keys, photo_ids) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [s.pid, s.name ?? null, wanted.filter((id) => about.includes(id)), String(b.title ?? "").trim().slice(0, 200), body, photos.map((p) => p.key), photos.map((p) => p.thumbKey), photoIds]);
  return NextResponse.json({ ok: true });
}
