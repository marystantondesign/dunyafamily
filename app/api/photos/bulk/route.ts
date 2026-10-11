import { NextResponse } from "next/server";
import { badRequest, canRemove, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { resolveOccasions, resolvePeople } from "@/lib/tags";

type Body =
  | { ids: number[]; action: "date"; year?: number | null; decade?: number | null }
  | { ids: number[]; action: "person" | "occasion"; value: number | string }
  | { ids: number[]; action: "remove" };

const plural = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

/**
 * Select mode in browse. Same rules as one photo at a time: anyone can add people and occasions,
 * anyone can fill in a missing date, and changing a date or removing a photo is for the uploader or admin.
 * Photos the person isn't allowed to change are left alone and counted as skipped.
 */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  const body = (await req.json()) as Body;
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(Number).filter(Number.isInteger))] : [];
  if (!ids.length) return badRequest("Select at least one photo.");
  if (ids.length > 500) return badRequest("Select up to 500 photos at a time.");

  const photos = await q<{ id: number; uploaded_by_device: string; year: number | null; decade: number | null }>(
    `select id, uploaded_by_device, year, decade from photos where id = any($1::int[]) and deleted_at is null`, [ids]);
  const all = photos.map((p) => p.id);

  if (body.action === "person" || body.action === "occasion") {
    const [tagId] = body.action === "person" ? await resolvePeople([body.value], s) : await resolveOccasions([body.value], s);
    if (!tagId) return badRequest(body.action === "person" ? "Add a name." : "Add an occasion.");
    const table = body.action === "person" ? "photo_people (photo_id, person_id, added_by_device)" : "photo_occasions (photo_id, occasion_id, added_by_device)";
    await q(`insert into ${table} select unnest($1::int[]), $2, $3 on conflict do nothing`, [all, tagId, s.did]);
    const [named] = await q<{ name: string }>(
      body.action === "person" ? `select name from people where id = $1` : `select name from occasions where id = $1`, [tagId]);
    return NextResponse.json({ changed: all.length, skipped: 0, message: `Added ${named?.name ?? "that"} to ${plural(all.length)}.` });
  }

  if (body.action === "date") {
    const year = body.year ? Number(body.year) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1850 || year > new Date().getFullYear())) return badRequest("That year doesn't look right.");
    const decade = year ? Math.floor(year / 10) * 10 : body.decade ? Number(body.decade) : null;
    if (decade === null) return badRequest("Choose a year or a decade.");
    if (decade % 10 !== 0 || decade < 1850 || decade > 2100) return badRequest("That decade doesn't look right.");
    // Filling in a blank is open to everyone. Replacing a date someone set is for the uploader or admin.
    const allowed = photos.filter((p) =>
      canRemove(s, p.uploaded_by_device) || (year ? p.year === null : p.year === null && p.decade === null)).map((p) => p.id);
    if (allowed.length) await q(`update photos set year = $1, decade = $2 where id = any($3::int[])`, [year, decade, allowed]);
    const skipped = all.length - allowed.length;
    const when = year ?? `${decade}s`;
    const message = !allowed.length
      ? `Nothing changed. ${skipped === 1 ? "That photo already has" : "These photos already have"} a date from someone else.`
      : `Set ${when} on ${plural(allowed.length)}.${skipped ? ` ${plural(skipped)} already had a date from someone else, so they stayed as they were.` : ""}`;
    return NextResponse.json({ changed: allowed.length, skipped, message });
  }

  if (body.action === "remove") {
    const allowed = photos.filter((p) => canRemove(s, p.uploaded_by_device)).map((p) => p.id);
    if (allowed.length) await q(`update photos set deleted_at = now(), deleted_by_name = $2 where id = any($1::int[])`, [allowed, s?.name ?? null]);
    const skipped = all.length - allowed.length;
    const message = !allowed.length
      ? "Nothing was removed. Only the person who added a photo, or Mary, can remove it."
      : `Removed ${plural(allowed.length)}.${skipped ? ` ${plural(skipped)} added by someone else stayed.` : ""}`;
    return NextResponse.json({ changed: allowed.length, skipped, message });
  }

  return badRequest("Unknown action.");
}
