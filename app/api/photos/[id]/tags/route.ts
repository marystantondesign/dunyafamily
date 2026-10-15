import { NextResponse } from "next/server";
import { badRequest, canRemove, forbidden, getSession, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";
import { noteRecent, resolveOccasions, resolvePeople } from "@/lib/tags";

type Ctx = { params: Promise<{ id: string }> };
type Body = { kind: "person" | "occasion"; value: number | string };

export async function POST(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const photoId = Number((await params).id);
  const { kind, value } = (await req.json()) as Body;
  if (kind === "person") {
    const [pid] = await resolvePeople([value], s);
    if (!pid) return badRequest("Add a name.");
    await q(`insert into photo_people (photo_id, person_id, added_by_device) values ($1,$2,$3) on conflict do nothing`, [photoId, pid, s.did]);
    await noteRecent(s, [pid]);
  } else if (kind === "occasion") {
    const [oid] = await resolveOccasions([value], s);
    if (!oid) return badRequest("Add an occasion.");
    await q(`insert into photo_occasions (photo_id, occasion_id, added_by_device) values ($1,$2,$3) on conflict do nothing`, [photoId, oid, s.did]);
  } else return badRequest("Unknown tag type.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const s = await getSession();
  if (!s) return unauthorized();
  const photoId = Number((await params).id);
  const { kind, value } = (await req.json()) as Body;
  const table = kind === "person" ? "photo_people" : kind === "occasion" ? "photo_occasions" : null;
  const col = kind === "person" ? "person_id" : "occasion_id";
  if (!table) return badRequest("Unknown tag type.");
  const [tag] = await q<{ added_by_device: string | null; uploaded_by_device: string }>(
    `select t.added_by_device, p.uploaded_by_device from ${table} t join photos p on p.id = t.photo_id
      where t.photo_id = $1 and t.${col} = $2`,
    [photoId, Number(value)],
  );
  if (!tag) return NextResponse.json({ ok: true });
  if (!canRemove(s, tag.added_by_device) && !canRemove(s, tag.uploaded_by_device)) return forbidden();
  await q(`delete from ${table} where photo_id = $1 and ${col} = $2`, [photoId, Number(value)]);
  return NextResponse.json({ ok: true });
}
