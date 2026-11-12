import Link from "next/link";
import { redirect } from "next/navigation";
import { BrowseFilters } from "@/components/BrowseFilters";
import { BrowseResults } from "@/components/BrowseResults";
import { Icon } from "@/components/Icon";
import { albumOptions, myAlbumOptions } from "@/lib/albums";
import { canRemove, getSession } from "@/lib/auth";
import { decadesInUse, listOccasions, listPeople } from "@/lib/data";
import { defaultOrder, filterQuery, filtersFrom, hasFilters, ids, resolveOrder, type SP } from "@/lib/filters";
import { favoriteCount } from "@/lib/favorites";
import { Star } from "@/components/Star";
import { QBadge } from "@/components/TaggingNeeded";
import { taggingNeededCount } from "@/lib/taggingNeeded";
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
  const s = await getSession();
  const filters = filtersFrom(sp, occasions, s?.pid);
  const favorites = sp.favorites === "1";
  const tagging = sp.tagging === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = filterQuery(sp);
  // No filters: everything, shuffled once per visit. With filters: newest first, unless a sort was picked.
  const order = resolveOrder(sp, filters);
  const fallback = defaultOrder(filters);
  const seed = await shuffleSeed();
  const [photos, total, nFavorites, nFlagged] = await Promise.all([
    findPhotos(filters, { order, seed, limit: PAGE, offset: (page - 1) * PAGE }),
    countPhotos(filters),
    favorites ? favoriteCount(s?.pid) : Promise.resolve(0),
    taggingNeededCount(),
  ]);
  const params = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "q" && k !== "select")) as Record<string, string>;

  // Everything that's filtering the photos, as removable chips above the grid.
  // People, albums, occasions, and decades show in the filter rows' hints; the rest get a removable chip.
  const chips: { key: string; label: string; icon: "person" | "calendar" | "photo" | "album"; clear: SP }[] = [
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
        favorites={favorites}
        tagging={{ on: tagging, count: nFlagged }}
      />
      <div className="browse-main">
        <form action="/browse" role="search">
          <label htmlFor="bq" className="sr-only">Search photos, people, or occasions</label>
          <div className="search-field">
            <Icon name="search" />
            <input id="bq" name="q" placeholder="Search photos, people, or occasions" />
          </div>
        </form>

        <div className="browse-bar">
          {/* Phones: Favorites comes first in the chip row. Desktop has "Your favorites" at the top of Filters. */}
          <Link href={href(sp, { tagging: tagging ? undefined : "1" })} className={`tn-chip phone-only${tagging ? " on" : ""}`} aria-pressed={tagging}>
            <QBadge size={20} /> Tagging needed
          </Link>
          <Link href={href(sp, { favorites: favorites ? undefined : "1", order: favorites && sp.order === "favorited" ? undefined : sp.order })}
            className={`fav-chip phone-only${favorites ? " on" : ""}`} aria-pressed={favorites}>
            <Star on={favorites} size={14} /> Favorites
          </Link>
          {chips.map((c) => (
            <Link key={c.key} href={href(sp, c.clear)} className="chip" aria-label={`Remove ${c.label}`}>
              <Icon name={c.icon} size={16} /> {c.label} <Icon name="x" size={14} stroke={2} />
            </Link>
          ))}
          {chips.length > 0 && <Link href={href(sp, { year: undefined, month: undefined, season: undefined, untagged: undefined, batch: undefined })} className="small">Clear filters</Link>}
        </div>

        {photos.length ? (
          <BrowseResults
            // Only what the browser needs: no file keys or device ids.
            photos={photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, year: p.year, decade: p.decade, month: p.month, removable: canRemove(s, p.uploaded_by_device) }))}
            query={qs}
            total={total}
            sort={{ value: order, fallback, params, filtered: hasFilters(filters), favorites, tagging }}
            people={people.map(({ id, name, aliases }) => ({ id, name, aliases }))}
            occasions={occasions}
            albums={await myAlbumOptions(s)}
            allIdsQuery={qs}
            startSelecting={sp.select === "1"}
          />
        ) : tagging && nFlagged === 0 ? (
          <div className="fav-empty">
            <p>Every photo is tagged. Nice work.</p>
            <Link href={href(sp, { tagging: undefined })} className="btn">Show all photos</Link>
          </div>
        ) : favorites && nFavorites === 0 ? (
          <div className="fav-empty">
            <p>No favorites yet. Tap the star on any photo to save it here.</p>
            <Link href={href(sp, { favorites: undefined, order: sp.order === "favorited" ? undefined : sp.order })} className="btn">Show all photos</Link>
          </div>
        ) : <p className="muted">No photos match all of those yet. Try removing a filter.</p>}

        {total > page * PAGE && (
          <p style={{ marginTop: 24 }}><Link className="btn" href={href(sp, { page: String(page + 1) })}>Show more</Link></p>
        )}
      </div>
    </div>
  );
}
