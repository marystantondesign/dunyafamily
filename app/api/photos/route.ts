import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { addToAlbum, resolveAlbum } from "@/lib/albums";
import { addComment } from "@/lib/comments";
import { noteRecent, resolveOccasions, resolvePeople } from "@/lib/tags";

type Body = {
  photos: { originalKey: string; thumbKey: string; width: number; height: number; takenOn?: string | null }[];
  tags: { people: (number | string)[]; occasions: (number | string)[]; year?: number | null; decade?: number | null; caption?: string };
  /** Scans and phone photos of old prints: the camera date is when the print was copied, not when the photo was taken. */
  scans?: boolean;
  /** A shared album for the whole batch: one that exists, or a new one by name. */
  album?: { albumId?: number; newTitle?: string } | null;
};

const KEY = /^(originals|thumbs)\/[0-9a-f-]{36}\.[a-z]+$/;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const { photos, tags, scans, album: albumPick } = (await req.json()) as Body;
  if (!photos?.length) return badRequest("No photos to save.");
  if (photos.some((p) => !KEY.test(p.originalKey) || !KEY.test(p.thumbKey))) return badRequest("Unexpected file keys.");
  // Settle the album first, so a problem with it doesn't leave photos half-saved.
  const album = await resolveAlbum(albumPick, s);
  if (album && "error" in album) return badRequest(album.error);

  const peopleIds = await resolvePeople(tags.people ?? [], s);
  const occasionIds = await resolveOccasions(tags.occasions ?? [], s);
  // The upload note becomes the first comment on each photo.
  const note = tags.caption?.trim().slice(0, 2000) || null;

  const batch = crypto.randomUUID();
  const ids: number[] = [];
  for (const p of photos) {
    // A date saved by the camera beats the batch's shared year, unless these are scans of old prints.
    const taken = !scans && p.takenOn && /^\d{4}-\d{2}-\d{2}$/.test(p.takenOn) ? p.takenOn : null;
    const year = taken ? Number(taken.slice(0, 4)) : tags.year ?? null;
    const month = taken ? Number(taken.slice(5, 7)) : null;
    const decade = year ? Math.floor(year / 10) * 10 : tags.decade ?? null;
    const [row] = await q<{ id: number }>(
      `insert into photos (original_key, thumb_key, width, height, taken_on, year, month, decade, caption, uploaded_by_device, uploaded_by_name, upload_batch)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
      [p.originalKey, p.thumbKey, p.width, p.height, taken, year, month, decade, null, s.did, s.name, batch],
    );
    ids.push(row.id);
  }

  if (peopleIds.length)
    await q(
      `insert into photo_people (photo_id, person_id, added_by_device)
       select ph, pe, $3 from unnest($1::int[]) ph cross join unnest($2::int[]) pe on conflict do nothing`,
      [ids, peopleIds, s.did],
    );
  await noteRecent(s, peopleIds);
  if (occasionIds.length)
    await q(
      `insert into photo_occasions (photo_id, occasion_id, added_by_device)
       select ph, oc, $3 from unnest($1::int[]) ph cross join unnest($2::int[]) oc on conflict do nothing`,
      [ids, occasionIds, s.did],
    );

  if (album) await addToAlbum(album.id, ids, s);
  if (note) for (const pid of ids) await addComment(pid, note, s);

  return NextResponse.json({ ids, batch, albumId: album?.id ?? null });
}
