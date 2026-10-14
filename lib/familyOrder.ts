import { findDunya } from "./featured";
import { loadFamily, type Family } from "./family";

/**
 * Family order, the one place it's decided: Dunya, then her descendants generation by generation (each family
 * together, in their parents' order, oldest first), then her parents, her brothers and sisters, and her
 * grandparents. Computed from the tree, so new descendants slot in on their own. Everyone else (partners,
 * co-parents, siblings' families, anyone not placed) is "partners and extended family".
 */
export function computeFamilyOrder(f: Family, rootId: number): number[] {
  const order = [rootId];
  const seen = new Set(order);
  let level = [rootId];
  while (level.length) {
    const next: number[] = [];
    for (const p of level) for (const c of f.children(p)) if (!seen.has(c)) { seen.add(c); next.push(c); }
    order.push(...next);
    level = next;
  }
  // Mothers before fathers, as in "Helen, Louis".
  const motherFirst = (ids: number[]) => [...ids].sort((a, b) => Number(f.byId.get(a)?.gender !== "female") - Number(f.byId.get(b)?.gender !== "female"));
  const add = (ids: number[]) => { for (const id of ids) if (!seen.has(id)) { seen.add(id); order.push(id); } };
  const parents = motherFirst(f.parents(rootId));
  add(parents);
  add(f.siblings(rootId));
  for (const p of parents) add(motherFirst(f.parents(p)));
  return order;
}

export async function familyOrder(): Promise<number[]> {
  const [f, dunya] = await Promise.all([loadFamily(), findDunya()]);
  return dunya && f.byId.has(dunya.id) ? computeFamilyOrder(f, dunya.id) : [];
}
