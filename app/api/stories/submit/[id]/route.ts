import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { adminOr404 } from "@/lib/storySave";
import { draftFrom } from "@/lib/submissions";

type Ctx = { params: Promise<{ id: string }> };

/** Mary only: make a submitted story into a new draft (the sender kept as its credit). */
export async function POST(_req: Request, { params }: Ctx) {
  const no = await adminOr404();
  if (no) return no;
  const id = await draftFrom(Number((await params).id));
  if (!id) return NextResponse.json({ error: "That story isn't here anymore." }, { status: 404 });
  return NextResponse.json({ id });
}

/** Mary only: delete a submitted story (soft delete; its photos stay in storage). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const no = await adminOr404();
  if (no) return no;
  await q(`update story_submissions set deleted_at = now() where id = $1`, [Number((await params).id)]);
  return NextResponse.json({ ok: true });
}
