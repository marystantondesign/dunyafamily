import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { OccasionList } from "@/components/OccasionList";
import { getSession, isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Occasions (Mary only): every occasion with how many photos have it, and a way to remove one. */
export default async function OccasionsPage() {
  if (!isAdmin(await getSession())) notFound();
  const rows = await q<{ id: number; name: string; n: number }>(
    `select o.id, o.name, (select count(*)::int from photo_occasions x join photos p on p.id = x.photo_id and p.deleted_at is null where x.occasion_id = o.id) as n
       from occasions o where o.deleted_at is null order by lower(o.name)`);
  return (
    <div className="oc-page">
      <Link href="/you" className="back-link"><Icon name="chevronLeft" size={16} /> Settings</Link>
      <h1>Occasions</h1>
      <p className="oc-sub">Removing one takes it out of the filters and off every photo. The photos stay. Typing the name again as a tag brings it back.</p>
      <OccasionList rows={rows} />
    </div>
  );
}
