import { seasonMonths } from "./hero";
import type { Occasion } from "./data";
import type { Filters, Order } from "./photos";

export type SP = Record<string, string | undefined>;
export const ids = (v?: string) => (v ? v.split(",").map(Number).filter(Boolean) : []);

/** The same query params work on /browse and /tag, so a browse view can be tagged as-is. */
export function filtersFrom(sp: SP, occasions: Occasion[]): Filters {
  const f: Filters = {
    people: ids(sp.people),
    occasions: ids(sp.occasions),
    decades: ids(sp.decade),
    year: Number(sp.year) || undefined,
    months: sp.month ? [Number(sp.month)] : undefined,
    untagged: sp.untagged === "1",
    batch: sp.batch || undefined,
    albums: ids(sp.albums),
  };
  if (sp.season && seasonMonths(sp.season))
    f.season = { months: seasonMonths(sp.season), occasionId: occasions.find((o) => o.name === sp.season)?.id };
  return f;
}

const FILTER_KEYS = ["people", "occasions", "decade", "year", "month", "season", "untagged", "batch", "albums", "order"];
const ORDERS = new Set(["oldest", "newest", "recent", "shuffled"]);

/** Just the filter params, in a stable order, for links and for remembering a place. */
export function filterQuery(sp: SP) {
  const qs = new URLSearchParams();
  for (const k of FILTER_KEYS) if (sp[k] && (k !== "order" || ORDERS.has(sp[k]!))) qs.set(k, sp[k]!);
  return qs.toString();
}

/** Whether any filter is on. With none, browse shows everything shuffled. */
export const hasFilters = (f: Filters) =>
  !!(f.people?.length || f.occasions?.length || f.decades?.length || f.decade || f.year || f.months?.length || f.season || f.untagged || f.batch || f.albums?.length);

/** The order a view uses: what the person picked, else shuffled with no filters and newest first with filters. */
export function resolveOrder(sp: SP, f: Filters): Order {
  if (sp.order && ORDERS.has(sp.order)) return sp.order as Order;
  return hasFilters(f) ? "newest" : "shuffled";
}
