import Link from "next/link";
import { redirect } from "next/navigation";
import { Gallery } from "@/components/Gallery";
import { decadesInUse, listOccasions, listPeople } from "@/lib/data";
import { filterQuery, filtersFrom, ids, type SP } from "@/lib/filters";
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
  const [people, occasions, decades] = await Promise.all([listPeople(), listOccasions(), decadesInUse()]);

  // Free-text search becomes pills: names, occasions, years ("1994"), and decades ("1990s", "90s").
  if (sp.q !== undefined) {
    const text = sp.q.toLowerCase();
    const pIds = people.filter((p) => [p.name, ...p.aliases].some((n) => text.includes(n.toLowerCase()))).map((p) => p.id);
    const oIds = occasions.filter((o) => text.includes(o.name.toLowerCase())).map((o) => o.id);
    const decade = text.match(/\b(1[89]\d0|20\d0)s\b/)?.[1] ?? (text.match(/\b(\d)0s\b/) ? `19${text.match(/\b(\d)0s\b/)![1]}0` : undefined);
    const year = decade ? undefined : text.match(/\b(18|19|20)\d{2}\b/)?.[0];
    redirect(href({}, { people: pIds.join(",") || undefined, occasions: oIds.join(",") || undefined, decade, year }));
  }

  const sel = { people: ids(sp.people), occasions: ids(sp.occasions), decade: Number(sp.decade) || undefined };
  const filters = filtersFrom(sp, occasions);
  const page = Math.max(1, Number(sp.page) || 1);
  const [photos, total] = await Promise.all([
    findPhotos(filters, { order: sp.order === "oldest" ? "oldest" : "newest", limit: PAGE, offset: (page - 1) * PAGE }),
    countPhotos(filters),
  ]);
  const extras = [
    filters.year && { label: String(filters.year), clear: { year: undefined } },
    sp.month && { label: `${MONTHS[Number(sp.month) - 1]}s`, clear: { month: undefined } },
    sp.season && { label: `${sp.season}s`, clear: { season: undefined } },
    filters.untagged && { label: "Needs tags", clear: { untagged: undefined } },
    filters.batch && { label: "One upload", clear: { batch: undefined } },
  ].filter(Boolean) as { label: string; clear: SP }[];
  const anyFilter = sel.people.length || sel.occasions.length || sel.decade || extras.length;

  return (
    <>
      <form action="/browse" className="search" role="search">
        <label htmlFor="q" className="sr-only">Search photos</label>
        <input id="q" name="q" placeholder="Try Grandma Christmas 1990s" />
        <button className="btn">Search</button>
      </form>

      <div className="filter-group">
        <h3>People</h3>
        <div className="pills">
          {people.map((p) => (
            <Link key={p.id} className={`pill${sel.people.includes(p.id) ? " on" : ""}`} href={href(sp, { people: toggle(sel.people, p.id) })}>{p.name}</Link>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <h3>Occasions</h3>
        <div className="pills">
          {occasions.map((o) => (
            <Link key={o.id} className={`pill${sel.occasions.includes(o.id) ? " on" : ""}`} href={href(sp, { occasions: toggle(sel.occasions, o.id) })}>{o.name}</Link>
          ))}
        </div>
      </div>
      {decades.length > 0 && (
        <div className="filter-group">
          <h3>Decades</h3>
          <div className="pills">
            {decades.map((d) => (
              <Link key={d} className={`pill${sel.decade === d ? " on" : ""}`} href={href(sp, { decade: sel.decade === d ? undefined : String(d), year: undefined })}>{d}s</Link>
            ))}
          </div>
        </div>
      )}

      <div className="hero-head" style={{ marginTop: 32 }}>
        <p className="muted" style={{ margin: 0 }}>
          {total} {total === 1 ? "photo" : "photos"}
          {extras.map((x) => (
            <span key={x.label}> · {x.label} <Link href={href(sp, x.clear)} aria-label={`Clear ${x.label}`}>×</Link></span>
          ))}
          {anyFilter ? <> · <Link href="/browse">Clear all</Link></> : null}
        </p>
        <span className="small" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {total > 0 && <Link className="btn" href={`/tag${filterQuery(sp) ? `?${filterQuery(sp)}` : ""}`}>Tag these</Link>}
          <span>
          <Link href={href(sp, { order: undefined })} aria-current={sp.order !== "oldest"}>Newest first</Link>
          {" or "}
          <Link href={href(sp, { order: "oldest" })} aria-current={sp.order === "oldest"}>Oldest first</Link>
          </span>
        </span>
      </div>

      {photos.length ? <Gallery photos={photos} showWhen /> : <p className="muted">No photos match all of those yet. Try removing a filter.</p>}

      {total > page * PAGE && (
        <p style={{ marginTop: 24 }}><Link className="btn" href={href(sp, { page: String(page + 1) })}>Show more</Link></p>
      )}
    </>
  );
}
