import { cache } from "react";
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
    "Mary", "Julie", "Jenni", "Nadia", "Memrie", "Danielle", "Jessica", "Lane", "Leah", "Justice", "Afreen", "Clark", "Charlie",
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

/**
 * Round 17 (the Browse spec): grandchildren grouped by parent (Mary, Julie, Jenni, Nadia, Memrie, Danielle, Jessica,
 * Lane, Leah), and in the earlier part Dunya's brothers and sisters before her parents. Applied once to the saved
 * list; anyone not named keeps their place after them, so Mary's own changes otherwise stay.
 */
const V2_MAIN = ["Dunya", "Lucy", "Sandra", "Cindy", "TJ", "Scott", "Mary", "Julie", "Jenni", "Nadia", "Memrie", "Danielle", "Jessica", "Lane", "Leah"];

async function applyV2(f: Family, o: StoredOrder): Promise<StoredOrder> {
  const [done] = await q(`select 1 from settings where key = 'family_order_v2'`);
  if (done) return o;
  const dunya = await findDunya();
  const inMain = { ...f, people: f.people.filter((p) => o.main.includes(p.id)) } as Family;
  const named = matchNames(inMain, V2_MAIN, new Set());
  const main = [...named, ...o.main.filter((id) => !named.includes(id))];
  let earlier = o.earlier;
  if (dunya && f.byId.has(dunya.id)) {
    const sibs = new Set(f.siblings(dunya.id)), parents = new Set(f.parents(dunya.id));
    earlier = [...o.earlier.filter((id) => sibs.has(id)), ...o.earlier.filter((id) => parents.has(id)), ...o.earlier.filter((id) => !sibs.has(id) && !parents.has(id))];
  }
  const next = { main, earlier };
  await saveOrder(next);
  await q(`insert into settings (key, value) values ('family_order_v2', '1') on conflict (key) do nothing`);
  return next;
}

export async function storedOrder(f?: Family): Promise<StoredOrder> {
  const [row] = await q<{ value: string | null }>(`select value from settings where key = 'family_order'`);
  if (row?.value) {
    try {
      const v = JSON.parse(row.value) as StoredOrder;
      if (Array.isArray(v.main) && Array.isArray(v.earlier)) return applyV2(f ?? await loadFamily(), v);
    } catch { /* fall through and start again */ }
  }
  const fam = f ?? await loadFamily();
  const used = new Set<number>();
  const start = { main: matchNames(fam, START.main, used), earlier: matchNames(fam, START.earlier, used) };
  await q(`insert into settings (key, value) values ('family_order', $1) on conflict (key) do nothing`, [JSON.stringify(start)]);
  return applyV2(fam, start);
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

/**
 * Everyone, for any list of people: the family order, then Dunya's spouses and partners, then everyone else (those
 * in the most photos first). Never A to Z, except where someone picks A to Z (Home's Everyone list).
 */
export const peopleOrder = cache(async (): Promise<Map<number, number>> => {
  const [f, dunya, order, counts] = await Promise.all([loadFamily(), findDunya(), familyOrder(),
    q<{ id: number; n: number }>(`select person_id as id, count(*)::int as n from photo_people group by person_id`)]);
  const n = new Map(counts.map((c) => [c.id, c.n]));
  const ids = [...order, ...(dunya ? f.partners(dunya.id) : [])];
  const rest = f.people.map((p) => p.id).filter((id) => !ids.includes(id)).sort((a, b) => (n.get(b) ?? 0) - (n.get(a) ?? 0) || a - b);
  const rank = new Map<number, number>();
  for (const id of [...ids, ...rest]) if (!rank.has(id)) rank.set(id, rank.size);
  return rank;
});

/** Sort any list of people into peopleOrder. */
export async function inFamilyOrder<T extends { id: number }>(list: T[]): Promise<T[]> {
  const rank = await peopleOrder();
  return [...list].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9) || a.id - b.id);
}
