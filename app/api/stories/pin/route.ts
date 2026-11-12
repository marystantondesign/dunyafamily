import { NextResponse } from "next/server";
import { forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

/** Mary only: pin a story as featured ({ id }), or go back to one a day ({ id: null }). */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return forbidden();
  const { id } = (await req.json().catch(() => ({}))) as { id?: number | null };
  if (id) await q(`insert into settings (key, value) values ('story_pin', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`, [String(Number(id))]);
  else await q(`delete from settings where key = 'story_pin'`);
  return NextResponse.json({ ok: true });
}
