import { findDunya } from "./featured";
import { loadFamily, type Family } from "./family";
import { q } from "./db";
import { bloodRelatives } from "./signin";

/**
 * Family order is a list Mary set, saved in settings (family_order) so she can change it later (Admin, Family
 * order). "main" is Dunya and her descendants, "earlier" her parents, brothers and sisters, and grandparents.
 * Blood relatives added later and not placed yet go at the end of main. Everyone else is "partners and extended
 * family". Used by Home's Everyone list, the sign-in picker, and the people offered first when tagging.
 */
export type StoredOrder = { main: number[]; earlier: number[] };

/** The order Mary sent (round 15), by name. Matched to people once, the first time it's needed. */
const START = {
  main: ["Dunya", "Lucy", "Sandra", "Cindy", "TJ", "Scott",
    "Nadia", "Julie", "Jenni", "Memrie", "Danielle", "Mary", "Jessica", "Lane", "Justice", "Afreen", "Leah", "Clark", "Charlie",
    "Knox", "Elise", "Livi", "Briggs", "Ben Jr", "Gunnar", "Harper"],
  earlier: ["Helen", "Louis", "Kaya", "Diana", "Lucaria", "Nyooti", "Fannie", "Michael", "Agnes", "George"],
};

/** Each name to one person: the whole name first (or an alias), then a first name only one person has. */
function matchNames(f: Family, names: string[], used: Set<number>) {
  const people = f.people;
  const ids: number[] = [];
  for (const n of names) {
    const want = n.toLowerCase();
    const whole = people.filter((p) => !used.has(p.id) && (p.name.toLowerCase() === want || p.aliases.some((a) => a.toLowerCase() === want)));
    const first = people.filter((p) => !used.has(p.id) && p.name.toLowerCase().split(" ")[0] === want);
    const hit = whole.length === 1 ? whole[0] : whole.length === 0 && first.length === 1 ? first[0] : null;
    if (hit) { used.add(hit.id); ids.push(hit.id); }
  }
  return ids;
}

export async function storedOrder(f?: Family): Promise<StoredOrder> {
  const [row] = await q<{ value: string | null }>(`select value from settings where key = 'family_order'`);
  if (row?.value) {
    try {
      const v = JSON.parse(row.value) as StoredOrder;
      if (Array.isArray(v.main) && Array.isArray(v.earlier)) return v;
    } catch { /* fall through and start again */ }
  }
  const fam = f ?? await loadFamily();
  const used = new Set<number>();
  const start = { main: matchNames(fam, START.main, used), earlier: matchNames(fam, START.earlier, used) };
  await q(`insert into settings (key, value) values ('family_order', $1) on conflict (key) do nothing`, [JSON.stringify(start)]);
  return start;
}

export async function saveOrder(o: StoredOrder) {
  await q(`insert into settings (key, value, updated_at) values ('family_order', $1, now())
           on conflict (key) do update set value = excluded.value, updated_at = now()`, [JSON.stringify(o)]);
}

/** Blood relatives who aren't in the saved order yet, oldest generation first. */
export function unplaced(f: Family, rootId: number, o: StoredOrder) {
  const placed = new Set([...o.main, ...o.earlier]);
  const blood = bloodRelatives(f, rootId);
  // Generation by generation from Dunya, so a new grandchild lands after the grandchildren already there.
  const out: number[] = [];
  let level = [rootId];
  const seen = new Set(level);
  while (level.length) {
    for (const id of level) if (!placed.has(id) && blood.has(id)) out.push(id);
    const next: number[] = [];
    for (const p of level) for (const c of f.children(p)) if (!seen.has(c)) { seen.add(c); next.push(c); }
    level = next;
  }
  for (const s of f.siblings(rootId)) if (!placed.has(s) && !out.includes(s)) out.push(s);
  return out;
}

/** The full family order: Mary's list, with blood relatives not placed yet at the end of the main part. */
export async function familyOrder(): Promise<number[]> {
  const [f, dunya] = await Promise.all([loadFamily(), findDunya()]);
  const o = await storedOrder(f);
  const alive = (ids: number[]) => ids.filter((id) => f.byId.has(id));
  const extra = dunya && f.byId.has(dunya.id) ? unplaced(f, dunya.id, o) : [];
  return [...alive(o.main), ...extra, ...alive(o.earlier)];
}
