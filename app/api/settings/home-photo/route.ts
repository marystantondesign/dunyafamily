import { NextResponse } from "next/server";
import { badRequest, forbidden, getSession, isAdmin, unauthorized } from "@/lib/auth";
import { q } from "@/lib/db";

/** The admin picks which photo leads the homepage polaroid. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return unauthorized();
  if (!isAdmin(s)) return forbidden();
  const { photoId } = (await req.json()) as { photoId?: number | null };
  if (photoId === null) {
    await q(`delete from settings where key = 'home_photo_id'`);
    return NextResponse.json({ ok: true });
  }
  const [photo] = await q(`select 1 from photos where id = $1 and deleted_at is null`, [Number(photoId)]);
  if (!photo) return badRequest("That photo isn't on the site anymore.");
  await q(
    `insert into settings (key, value, updated_at) values ('home_photo_id', $1, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [String(Number(photoId))],
  );
  return NextResponse.json({ ok: true });
}
