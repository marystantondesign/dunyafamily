import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Profile photo: anyone can set one if none exists yet; changing it is for whoever added the person, or the admin.
 * Renaming and aliases: whoever added the person, or the admin.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const body = (await req.json()) as { avatarPhotoId?: number; name?: string; aliases?: string[] };
  const [person] = await q<{ avatar_photo_id: number | null; created_by_device: string | null }>(
    `select avatar_photo_id, created_by_device from people where id = $1 and deleted_at is null`, [id]);
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });

  if (body.avatarPhotoId !== undefined) {
    if (person.avatar_photo_id !== null && !canRemove(s, person.created_by_device)) return forbidden();
    const [photo] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [body.avatarPhotoId]);
    if (!photo) return badRequest("That photo isn't on the site anymore.");
    await q(`update people set avatar_photo_id = $1 where id = $2`, [body.avatarPhotoId, id]);
  }
  if (body.name !== undefined || body.aliases !== undefined) {
    if (!isAdmin(s) && !canRemove(s, person.created_by_device)) return forbidden();
    if (body.name !== undefined && !body.name.trim()) return badRequest("Name can't be empty.");
    await q(`update people set name = coalesce($1, name), aliases = coalesce($2, aliases) where id = $3`, [
      body.name?.trim() ?? null,
      body.aliases ?? null,
      id,
    ]);
  }
  return NextResponse.json({ ok: true });
}

/**
 * Remove someone from the family: whoever added them, or the admin. Soft delete, so their photos stay,
 * their name drops off tags and lists, and the admin can restore them with everything intact.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const [person] = await q<{ created_by_device: string | null }>(`select created_by_device from people where id = $1 and deleted_at is null`, [id]);
  if (!person) return NextResponse.json({ ok: true });
  if (!canRemove(s, person.created_by_device)) return forbidden();
  await q(`update people set deleted_at = now() where id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
