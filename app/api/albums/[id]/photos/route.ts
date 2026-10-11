import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { addToAlbum, canTakeOut, getAlbum } from "@/lib/albums";
import { q } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };
const plural = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;
const idsFrom = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(Number).filter(Number.isInteger))] : []);

/** Add photos to an album. Anyone can. */
export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const album = await getAlbum(Number((await params).id));
  if (!album) return badRequest("That album isn't here anymore.");
  const ids = idsFrom(((await req.json().catch(() => ({}))) as { photoIds?: unknown }).photoIds);
  if (!ids.length) return badRequest("Choose at least one photo.");
  const added = await addToAlbum(album.id, ids, s);
  const already = ids.length - added;
  return NextResponse.json({
    added,
    message: added ? `Added ${plural(added)} to ${album.title}.${already ? ` ${plural(already)} ${already === 1 ? "was" : "were"} already there.` : ""}` : `Already in ${album.title}.`,
  });
}

/** Take photos out of an album (they stay on the site): whoever added them, whoever started the album, or Mary. */
export async function DELETE(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const album = await getAlbum(Number((await params).id));
  if (!album) return badRequest("That album isn't here anymore.");
  const ids = idsFrom(((await req.json().catch(() => ({}))) as { photoIds?: unknown }).photoIds);
  if (!ids.length) return badRequest("Choose at least one photo.");
  const rows = await q<{ photo_id: number; added_by_device: string | null }>(
    `select photo_id, added_by_device from album_photos where album_id = $1 and photo_id = any($2::int[])`, [album.id, ids]);
  const allowed = rows.filter((r) => canTakeOut(s, r.added_by_device, album.created_by_device)).map((r) => r.photo_id);
  if (allowed.length) await q(`delete from album_photos where album_id = $1 and photo_id = any($2::int[])`, [album.id, allowed]);
  if (allowed.includes(album.cover_photo_id ?? -1)) await q(`update albums set cover_photo_id = null where id = $1`, [album.id]);
  const skipped = rows.length - allowed.length;
  return NextResponse.json({
    removed: allowed.length,
    message: !allowed.length
      ? "Nothing was taken out. Only the person who added a photo here, whoever started the album, or Mary can."
      : `Took ${plural(allowed.length)} out of ${album.title}. ${allowed.length === 1 ? "It stays" : "They stay"} on the site.${skipped ? ` ${plural(skipped)} added by someone else stayed in the album.` : ""}`,
  });
}
