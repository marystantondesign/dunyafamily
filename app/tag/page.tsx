import { TagMode } from "@/components/TagMode";
import { canRemove, getSession } from "@/lib/auth";
import { listOccasions, listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { filterQuery, filtersFrom, resolveOrder, type SP } from "@/lib/filters";
import { shuffleSeed } from "@/lib/shuffle";
import { findForTagging } from "@/lib/photos";

export const dynamic = "force-dynamic";
const MAX = 1000;

export default async function TagPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = (await getSession())!;
  const [people, occasions] = await Promise.all([listPeople(), listOccasions()]);
  const filters = filtersFrom(sp, occasions);
  // A batch or the needs-tags pile goes in upload order; anything else follows the browse order it came from.
  const order = filters.batch || filters.untagged ? "uploaded" : resolveOrder(sp, filters);

  const [photos, personOrder, occasionUse] = await Promise.all([
    findForTagging(filters, order, MAX, await shuffleSeed()),
    // People you tagged most recently first, then whoever is in the most photos.
    // Falls back to most photos if the database hasn't been given the added_at column yet.
    q<{ id: number }>(
      `select pe.id from people pe left join photo_people x on x.person_id = pe.id
        where pe.deleted_at is null group by pe.id, pe.name
        order by max(case when x.added_by_device = $1 then x.added_at end) desc nulls last, count(x.photo_id) desc, lower(pe.name)`,
      [s.did],
    ).catch(() => q<{ id: number }>(
      `select pe.id from people pe left join photo_people x on x.person_id = pe.id
        where pe.deleted_at is null group by pe.id, pe.name order by count(x.photo_id) desc, lower(pe.name)`,
    )),
    q<{ id: number; n: number }>(`select occasion_id as id, count(*)::int as n from photo_occasions group by occasion_id`),
  ]);

  const rank = new Map(personOrder.map((p, i) => [p.id, i]));
  const uses = new Map(occasionUse.map((o) => [o.id, o.n]));
  const qs = filterQuery(sp);

  return (
    <TagMode
      photos={photos.map(({ uploaded_by_device, people: pp, occasions: oo, ...p }) => {
        const owner = canRemove(s, uploaded_by_device);
        return {
          ...p,
          owner,
          people: pp.map((t) => ({ id: t.id, removable: owner || canRemove(s, t.by) })),
          occasions: oo.map((t) => ({ id: t.id, removable: owner || canRemove(s, t.by) })),
        };
      })}
      people={[...people].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))}
      occasions={[...occasions].sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name))}
      placeKey={`df_tag:${qs}`}
      startId={Number(sp.start) || undefined}
      exitHref={filters.batch || filters.untagged || !qs ? "/" : `/browse?${qs}`}
      capped={photos.length === MAX}
    />
  );
}
