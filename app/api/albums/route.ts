import { NextResponse } from "next/server";
import { badRequest, getSession, unauthorized } from "@/lib/auth";
import { addToAlbum, resolveAlbum } from "@/lib/albums";

/** Start an album ({ title }), optionally with some photos in it ({ photoIds }). Anyone can. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { title?: string; photoIds?: number[] };
  const album = await resolveAlbum({ newTitle: body.title }, s);
  if (!album || "error" in album) return badRequest(album?.error ?? "Give the album a name.");
  const ids = Array.isArray(body.photoIds) ? body.photoIds.map(Number).filter(Number.isInteger) : [];
  const added = ids.length ? await addToAlbum(album.id, ids, s) : 0;
  return NextResponse.json({ ...album, message: added ? `Added ${added} ${added === 1 ? "photo" : "photos"} to ${album.title}.` : `Started ${album.title}.` });
}
