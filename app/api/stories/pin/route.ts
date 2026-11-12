import { NextResponse } from "next/server";
import { adminOr404 } from "@/lib/storySave";
import { q } from "@/lib/db";

/** Mary only: pin a story as featured ({ id }), or go back to one a day ({ id: null }). */
export async function POST(req: Request) {
  const no = await adminOr404();
  if (no) return no;
  const { id } = (await req.json().catch(() => ({}))) as { id?: number | null };
  if (id) await q(`insert into settings (key, value) values ('story_pin', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`, [String(Number(id))]);
  else await q(`delete from settings where key = 'story_pin'`);
  return NextResponse.json({ ok: true });
}
