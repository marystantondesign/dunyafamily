import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Profile photo: anyone can set one if none exists yet; changing it is admin only. Renaming is admin only. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const body = (await req.json()) as { avatarPhotoId?: number; name?: string; aliases?: string[] };
  const [person] = await q<{ avatar_photo_id: number | null }>(`select avatar_photo_id from people where id = $1 and deleted_at is null`, [id]);
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  if (body.avatarPhotoId !== undefined) {
    if (person.avatar_photo_id !== null && !isAdmin(s)) return forbidden();
    await q(`update people set avatar_photo_id = $1 where id = $2`, [body.avatarPhotoId, id]);
  }
  if (body.name !== undefined || body.aliases !== undefined) {
    if (!isAdmin(s)) return forbidden();
    if (body.name !== undefined && !body.name.trim()) return badRequest("Name can't be empty.");
    await q(`update people set name = coalesce($1, name), aliases = coalesce($2, aliases) where id = $3`, [
      body.name?.trim() ?? null,
      body.aliases ?? null,
      id,
    ]);
  }
  return NextResponse.json({ ok: true });
}
