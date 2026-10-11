import { Slideshow } from "@/components/Slideshow";
import { listOccasions, listPeople } from "@/lib/data";
import { albumOptions } from "@/lib/albums";
import { filterQuery, filtersFrom, hasFilters, ids, resolveOrder, type SP } from "@/lib/filters";
import { findSlides } from "@/lib/photos";
import { q } from "@/lib/db";
import { displayName } from "@/lib/names";
import { signGet } from "@/lib/r2";
import { shuffleSeed } from "@/lib/shuffle";

export const dynamic = "force-dynamic";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * The slideshow plays the same set as the view it came from: browse filters and order ride along in the URL.
 * With no filters it plays everything shuffled. ?start=ID begins at that photo; ?speed and ?labels=0 come from the start panel.
 */
export default async function SlideshowPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [people, occasions, albums] = await Promise.all([listPeople(), listOccasions(), albumOptions()]);
  const filters = filtersFrom(sp, occasions);
  const order = resolveOrder(sp, filters);
  const slides = (await findSlides(filters, order, await shuffleSeed())).map((s) => ({ ...s, people: s.people.map(displayName) }));
  const qs = filterQuery(sp);
  const startId = Number(sp.start) || null;
  const start = Math.max(0, slides.findIndex((s) => s.id === startId));
  const exitHref = startId ? `/photos/${startId}${qs ? `?${qs}` : ""}` : `/browse${qs ? `?${qs}` : ""}`;

  // The active filters as chips, like "Danielle".
  const name = (list: { id: number; name: string }[], id: number) => list.find((x) => x.id === id)?.name;
  const chips = [
    ...ids(sp.people).map((id) => name(people, id)),
    ...ids(sp.albums).map((id) => albums.find((a) => a.id === id)?.title),
    ...ids(sp.occasions).map((id) => name(occasions, id)),
    ...ids(sp.decade).map((d) => `${d}s`),
    ...(filters.year ? [String(filters.year)] : []),
    ...(sp.month ? [`${MONTHS[Number(sp.month) - 1]}s`] : []),
    ...(sp.season ? [`${sp.season}s`] : []),
    ...(filters.untagged ? ["Needs tags"] : []),
    ...(filters.batch ? ["One upload"] : []),
  ].filter((c): c is string => !!c);
  if (!hasFilters(filters)) chips.push("All photos");

  // Links for the first few photos, so the first one shows right away. The rest are fetched as it plays.
  const first = [0, 1, 2].map((k) => slides[(start + k) % Math.max(1, slides.length)]).filter(Boolean);
  const keys = first.length ? await q<{ id: number; original_key: string }>(`select id, original_key from photos where id = any($1::int[])`, [first.map((s) => s.id)]) : [];
  const initialLinks = Object.fromEntries(await Promise.all(keys.map(async (k) => [k.id, await signGet(k.original_key)] as const)));

  if (!slides.length) {
    return (
      <div className="ssv ssv-empty">
        <p>No photos match these filters yet.</p>
        <a href={exitHref} className="ssv-exit">Back</a>
      </div>
    );
  }
  return (
    <Slideshow slides={slides} start={start} chips={chips} exitHref={exitHref}
      initialSpeed={Number(sp.speed) || 5} labels={sp.labels !== "0"} initialLinks={initialLinks} />
  );
}
