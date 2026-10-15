import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { saveOrder } from "@/lib/familyOrder";

/** Save Mary's family order: two lists of person ids. */
export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return forbidden();
  const body = (await req.json().catch(() => ({}))) as { main?: unknown; earlier?: unknown };
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : null);
  const main = ids(body.main), earlier = ids(body.earlier);
  if (!main || !earlier) return badRequest("That list didn't come through. Try again.");
  const all = [...new Set([...main, ...earlier])];
  const rows = await q<{ id: number }>(`select id from people where id = any($1::int[]) and deleted_at is null`, [all]);
  const ok = new Set(rows.map((r) => r.id));
  const seen = new Set<number>();
  const clean = (l: number[]) => l.filter((id) => ok.has(id) && !seen.has(id) && seen.add(id));
  await saveOrder({ main: clean(main), earlier: clean(earlier) });
  return NextResponse.json({ ok: true });
}
