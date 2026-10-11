import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { cleanTitle, getAlbum } from "@/lib/albums";
import { q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Rename an album or choose its cover: whoever started it, or Mary. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const album = await getAlbum(Number((await params).id));
  if (!album) return badRequest("That album isn't here anymore.");
  const body = (await req.json().catch(() => ({}))) as { title?: string; coverPhotoId?: number };
  if (body.coverPhotoId !== undefined) {
    // Anyone can pick a cover while there isn't one yet.
    if (album.cover_photo_id && !canRemove(s, album.created_by_device)) return forbidden();
    const [inside] = await q(`select 1 from album_photos where album_id = $1 and photo_id = $2`, [album.id, Number(body.coverPhotoId)]);
    if (!inside) return badRequest("That photo isn't in this album.");
    await q(`update albums set cover_photo_id = $1 where id = $2`, [Number(body.coverPhotoId), album.id]);
  }
  if (body.title !== undefined) {
    if (!canRemove(s, album.created_by_device)) return forbidden();
    const title = cleanTitle(body.title);
    if (!title) return badRequest("Give the album a name.");
    const [twin] = await q(`select 1 from albums where deleted_at is null and lower(title) = lower($1) and id <> $2`, [title, album.id]);
    if (twin) return badRequest("There's already an album with that name.");
    await q(`update albums set title = $1 where id = $2`, [title, album.id]);
  }
  return NextResponse.json({ ok: true });
}

/** Delete an album: the photos stay on the site. Whoever started it, or Mary. Restorable. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const album = await getAlbum(Number((await params).id));
  if (!album) return badRequest("That album isn't here anymore.");
  if (!canRemove(s, album.created_by_device)) return forbidden();
  await q(`update albums set deleted_at = now(), deleted_by_name = $2 where id = $1`, [album.id, s?.name ?? null]);
  return NextResponse.json({ ok: true });
}
