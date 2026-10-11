import Link from "next/link";
import { redirect } from "next/navigation";
import { BrowseFilters } from "@/components/BrowseFilters";
import { BrowseResults } from "@/components/BrowseResults";
import { Icon } from "@/components/Icon";
import { albumOptions } from "@/lib/albums";
import { canRemove, getSession } from "@/lib/auth";
import { decadesInUse, listOccasions, listPeople } from "@/lib/data";
import { filterQuery, filtersFrom, hasFilters, ids, resolveOrder, type SP } from "@/lib/filters";
import { shuffleSeed } from "@/lib/shuffle";
import { countPhotos, findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";
const PAGE = 120;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function href(sp: SP, change: SP) {
  const next: SP = { ...sp, page: undefined, ...change };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
  return `/browse${qs.size ? `?${qs}` : ""}`;
}
const toggle = (list: number[], id: number) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]).join(",") || undefined;

export default async function Browse({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [people, occasions, decades, albums] = await Promise.all([listPeople(), listOccasions(), decadesInUse(), albumOptions()]);

  // Free-text search becomes pills: names, occasions, years ("1994"), and decades ("1990s", "90s").
  if (sp.q !== undefined) {
    const text = sp.q.toLowerCase();
    const pIds = people.filter((p) => [p.name, ...p.aliases].some((n) => text.includes(n.toLowerCase()))).map((p) => p.id);
    const oIds = occasions.filter((o) => text.includes(o.name.toLowerCase())).map((o) => o.id);
    const decade = text.match(/\b(1[89]\d0|20\d0)s\b/)?.[1] ?? (text.match(/\b(\d)0s\b/) ? `19${text.match(/\b(\d)0s\b/)![1]}0` : undefined);
    const year = decade ? undefined : text.match(/\b(18|19|20)\d{2}\b/)?.[0];
    redirect(href({}, { people: pIds.join(",") || undefined, occasions: oIds.join(",") || undefined, decade, year }));
  }

  const sel = { people: ids(sp.people), occasions: ids(sp.occasions), decades: ids(sp.decade), albums: ids(sp.albums) };
  const filters = filtersFrom(sp, occasions);
  const page = Math.max(1, Number(sp.page) || 1);
  const s = await getSession();
  const qs = filterQuery(sp);
  // No filters: everything, shuffled once per visit. With filters: newest first, unless a sort was picked.
  const order = resolveOrder(sp, filters);
  const fallback = hasFilters(filters) ? "newest" : "shuffled";
  const seed = await shuffleSeed();
  const [photos, total] = await Promise.all([
    findPhotos(filters, { order, seed, limit: PAGE, offset: (page - 1) * PAGE }),
    countPhotos(filters),
  ]);
  const params = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "q")) as Record<string, string>;

  // Everything that's filtering the photos, as removable chips above the grid.
  const nameOf = (list: { id: number; name: string }[], id: number) => list.find((x) => x.id === id)?.name ?? "Unknown";
  const chips: { key: string; label: string; icon: "person" | "calendar" | "photo" | "album"; clear: SP }[] = [
    ...sel.albums.map((id) => ({ key: `a${id}`, label: albums.find((a) => a.id === id)?.title ?? "Album", icon: "album" as const, clear: { albums: toggle(sel.albums, id) } })),
    ...sel.people.map((id) => ({ key: `p${id}`, label: nameOf(people, id), icon: "person" as const, clear: { people: toggle(sel.people, id) } })),
    ...sel.occasions.map((id) => ({ key: `o${id}`, label: nameOf(occasions, id), icon: "calendar" as const, clear: { occasions: toggle(sel.occasions, id) } })),
    ...sel.decades.map((d) => ({ key: `d${d}`, label: `${d}s`, icon: "calendar" as const, clear: { decade: toggle(sel.decades, d) } })),
    ...(filters.year ? [{ key: "y", label: String(filters.year), icon: "calendar" as const, clear: { year: undefined } }] : []),
    ...(sp.month ? [{ key: "m", label: `${MONTHS[Number(sp.month) - 1]}s`, icon: "calendar" as const, clear: { month: undefined } }] : []),
    ...(sp.season ? [{ key: "s", label: `${sp.season}s`, icon: "calendar" as const, clear: { season: undefined } }] : []),
    ...(filters.untagged ? [{ key: "u", label: "Needs tags", icon: "photo" as const, clear: { untagged: undefined } }] : []),
    ...(filters.batch ? [{ key: "b", label: "One upload", icon: "photo" as const, clear: { batch: undefined } }] : []),
  ];

  return (
    <div className="browse">
      <BrowseFilters
        people={people.map(({ id, name }) => ({ id, name }))}
        occasions={occasions.map(({ id, name }) => ({ id, name }))}
        decades={decades}
        albums={albums.map((a) => ({ id: a.id, name: a.title }))}
        selected={sel}
        params={params}
        sort={{ value: order, fallback }}
      />
      <div className="browse-main">
        <form action="/browse" role="search">
          <label htmlFor="bq" className="sr-only">Search photos, people, or occasions</label>
          <div className="search-field">
            <Icon name="search" />
            <input id="bq" name="q" placeholder="Search photos, people, or occasions..." />
          </div>
        </form>

        <div className="browse-bar">
          {chips.map((c) => (
            <Link key={c.key} href={href(sp, c.clear)} className="chip" aria-label={`Remove ${c.label}`}>
              <Icon name={c.icon} size={16} /> {c.label} <Icon name="x" size={14} stroke={2} />
            </Link>
          ))}
          {chips.length > 0 && <Link href="/browse" className="small">Clear filters</Link>}
        </div>

        {photos.length ? (
          <BrowseResults
            // Only what the browser needs: no file keys or device ids.
            photos={photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, year: p.year, decade: p.decade, month: p.month, removable: canRemove(s, p.uploaded_by_device) }))}
            query={qs}
            total={total}
            sort={{ value: order, fallback, params, filtered: hasFilters(filters) }}
            people={people.map(({ id, name, aliases }) => ({ id, name, aliases }))}
            occasions={occasions}
            albums={albums}
          />
        ) : <p className="muted">No photos match all of those yet. Try removing a filter.</p>}

        {total > page * PAGE && (
          <p style={{ marginTop: 24 }}><Link className="btn" href={href(sp, { page: String(page + 1) })}>Show more</Link></p>
        )}
      </div>
    </div>
  );
}
