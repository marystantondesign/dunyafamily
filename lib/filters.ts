import { seasonMonths } from "./hero";
import type { Occasion } from "./data";
import type { Filters, Order } from "./photos";

export type SP = Record<string, string | undefined>;
export const ids = (v?: string) => (v ? v.split(",").map(Number).filter(Boolean) : []);

/** The same query params work on /browse and /tag, so a browse view can be tagged as-is. */
/** `pid` is the person this visit picked: ?favorites=1 means their favorites, and nobody else's. */
export function filtersFrom(sp: SP, occasions: Occasion[], pid?: number): Filters {
  const f: Filters = {
    people: ids(sp.people),
    occasions: ids(sp.occasions),
    decades: ids(sp.decade),
    year: Number(sp.year) || undefined,
    months: sp.month ? [Number(sp.month)] : undefined,
    untagged: sp.untagged === "1",
    batch: sp.batch || undefined,
    albums: ids(sp.albums),
    // With no one picked there are no favorites to show, so the filter matches nothing.
    favoritesOf: sp.favorites === "1" ? pid ?? -1 : undefined,
    taggingNeeded: sp.tagging === "1",
  };
  if (sp.season && seasonMonths(sp.season))
    f.season = { months: seasonMonths(sp.season), occasionId: occasions.find((o) => o.name === sp.season)?.id };
  return f;
}

const FILTER_KEYS = ["people", "occasions", "decade", "year", "month", "season", "untagged", "batch", "albums", "favorites", "tagging", "order"];
const ORDERS = new Set(["oldest", "newest", "recent", "shuffled", "favorited"]);

/** Just the filter params, in a stable order, for links and for remembering a place. */
export function filterQuery(sp: SP) {
  const qs = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k] && (k !== "order" || ORDERS.has(sp[k]!))) qs.set(k, sp[k]!);
  return qs.toString();
}

/** Whether any filter is on. With none, browse shows everything shuffled. */
export const hasFilters = (f: Filters) =>
  !!(f.people?.length || f.occasions?.length || f.decades?.length || f.decade || f.year || f.months?.length || f.season || f.untagged || f.batch || f.albums?.length || f.favoritesOf || f.taggingNeeded);

/** Favorites or Tagging needed on their own are a whole pile to look through, so they shuffle like the full set does. */
const onlyFavorites = (f: Filters) => !!(f.favoritesOf || f.taggingNeeded) && !hasFilters({ ...f, favoritesOf: undefined, taggingNeeded: undefined });

/** The order a view gets when nobody picked one: shuffled with no filters (or just favorites), newest first with filters. */
export const defaultOrder = (f: Filters): Order => (!hasFilters(f) || onlyFavorites(f) ? "shuffled" : "newest");

/** The order a view uses: what the person picked, else the default. Newest favorited only applies with favorites on. */
export function resolveOrder(sp: SP, f: Filters): Order {
  if (sp.order && ORDERS.has(sp.order) && (sp.order !== "favorited" || f.favoritesOf)) return sp.order as Order;
  return defaultOrder(f);
}
