import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { resolveOccasions, resolvePeople } from "@/lib/tags";

type Ctx = { params: Promise<{ id: string }> };
type Body = { people: (number | string)[]; occasions: (number | string)[]; year: number | null; decade: number | null };

/**
 * Tagging mode saves a whole photo in one call: who's here, the occasions, and when.
 * Adding is open to everyone. Removing a tag follows canRemove (whoever added it, the uploader, or admin).
 * A date can be filled in by anyone; changing one that's already set is for the uploader or admin.
 */
export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const id = Number((await params).id);
  const body = (await req.json()) as Body;
  if (!Array.isArray(body.people) || !Array.isArray(body.occasions)) return badRequest("Nothing to save.");

  const [photo] = await q<{ uploaded_by_device: string; year: number | null; decade: number | null }>(
    `select uploaded_by_device, year, decade from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  const owner = canRemove(s, photo.uploaded_by_device);

  // Check every removal and date change before changing anything.
  const [curPeople, curOccasions] = await Promise.all([
    // Tags for people who were removed from the family stay put (restoring them brings their tags back).
    q<{ id: number; by: string | null }>(
      `select t.person_id as id, t.added_by_device as by from photo_people t join people pe on pe.id = t.person_id and pe.deleted_at is null where t.photo_id = $1`, [id]),
    q<{ id: number; by: string | null }>(`select occasion_id as id, added_by_device as by from photo_occasions where photo_id = $1`, [id]),
  ]);
  const keepP = new Set(body.people.filter((v): v is number => typeof v === "number"));
  const keepO = new Set(body.occasions.filter((v): v is number => typeof v === "number"));
  const dropP = curPeople.filter((t) => !keepP.has(t.id));
  const dropO = curOccasions.filter((t) => !keepO.has(t.id));
  if ([...dropP, ...dropO].some((t) => !owner && !canRemove(s, t.by))) return forbidden();

  const year = body.year ? Number(body.year) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1850 || year > new Date().getFullYear())) return badRequest("That year doesn't look right.");
  const decade = year ? Math.floor(year / 10) * 10 : body.decade ? Number(body.decade) : null;
  if (decade !== null && (decade % 10 !== 0 || decade < 1850 || decade > 2100)) return badRequest("That decade doesn't look right.");
  const yearChanged = year !== photo.year;
  const decadeChanged = decade !== photo.decade;
  if (yearChanged && photo.year !== null && !owner) return forbidden();
  if (!yearChanged && decadeChanged && photo.decade !== null && !owner) return forbidden();

  const [peopleIds, occasionIds] = [await resolvePeople(body.people, s), await resolveOccasions(body.occasions, s)];

  if (dropP.length) await q(`delete from photo_people where photo_id = $1 and person_id = any($2::int[])`, [id, dropP.map((t) => t.id)]);
  if (dropO.length) await q(`delete from photo_occasions where photo_id = $1 and occasion_id = any($2::int[])`, [id, dropO.map((t) => t.id)]);
  if (peopleIds.length)
    await q(`insert into photo_people (photo_id, person_id, added_by_device) select $1, unnest($2::int[]), $3 on conflict do nothing`, [id, peopleIds, s.did]);
  if (occasionIds.length)
    await q(`insert into photo_occasions (photo_id, occasion_id, added_by_device) select $1, unnest($2::int[]), $3 on conflict do nothing`, [id, occasionIds, s.did]);
  if (yearChanged || decadeChanged) await q(`update photos set year = $1, decade = $2 where id = $3`, [year, decade, id]);

  // Send back the saved state with real ids, so names typed in this session become regular people.
  const [people, occasions] = await Promise.all([
    q<{ id: number; name: string; by: string | null }>(
      `select pe.id, pe.name, t.added_by_device as by from photo_people t join people pe on pe.id = t.person_id and pe.deleted_at is null where t.photo_id = $1`, [id]),
    q<{ id: number; name: string; by: string | null }>(
      `select o.id, o.name, t.added_by_device as by from photo_occasions t join occasions o on o.id = t.occasion_id where t.photo_id = $1`, [id]),
  ]);
  const shape = (t: { id: number; name: string; by: string | null }) => ({ id: t.id, name: t.name, removable: owner || canRemove(s, t.by) });
  return NextResponse.json({ people: people.map(shape), occasions: occasions.map(shape), year, decade });
}
