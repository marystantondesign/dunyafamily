import { NextResponse } from "next/server";
import { getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { signGet } from "@/lib/r2";

/** Download original: a short link that makes the browser save the full-size file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const [p] = await q<{ original_key: string; year: number | null }>(`select original_key, year from photos where id = $1 and deleted_at is null`, [id]);
  if (!p) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const ext = p.original_key.split(".").pop() ?? "jpg";
  return NextResponse.redirect(await signGet(p.original_key, 60 * 5, `dunya-family-${p.year ? `${p.year}-` : ""}${id}.${ext}`));
}
