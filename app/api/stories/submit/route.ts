import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { SUB_KEY } from "@/lib/submissions";

/** Send a story to Mary. It isn't posted anywhere, and it can't be edited afterward. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!s.pid) return badRequest("Pick yourself first.");
  const b = (await req.json().catch(() => ({}))) as { about?: number[]; title?: string; body?: string; photos?: { key: string; thumbKey: string }[] };
  const body = String(b.body ?? "").replace(/\r\n/g, "\n").trim().slice(0, 100_000);
  if (!body) return badRequest("Write the story before sending it.");
  const photos = (b.photos ?? []).slice(0, 10).filter((p) => SUB_KEY.test(p.key) && SUB_KEY.test(p.thumbKey));
  const wanted = [...new Set((b.about ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  const about = wanted.length ? (await q<{ id: number }>(`select id from people where id = any($1::int[]) and deleted_at is null`, [wanted])).map((r) => r.id) : [];
  await q(
    `insert into story_submissions (person_id, submitted_by_name, about, title, body, photo_keys, thumb_keys) values ($1, $2, $3, $4, $5, $6, $7)`,
    [s.pid, s.name ?? null, wanted.filter((id) => about.includes(id)), String(b.title ?? "").trim().slice(0, 200), body, photos.map((p) => p.key), photos.map((p) => p.thumbKey)]);
  return NextResponse.json({ ok: true });
}
