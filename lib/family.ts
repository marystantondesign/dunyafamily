import { canRemove } from "./auth";
import { displayName } from "./names";
import { q } from "./db";
import { findDunya } from "./featured";
import { signGet } from "./r2";
import type { Session } from "./session";
import { resolvePeople } from "./tags";

export type Gender = "female" | "male" | null;
export type FPerson = {
  id: number; name: string; aliases: string[]; avatarUrl: string | null; inMemory: boolean; friend: boolean;
  gender: Gender; birthYear: number | null; birthOrder: number | null;
};
type Rel = { id: number; person_id: number; related_id: number; kind: "parent" | "partner" | "sibling"; label: string | null; created_by_device: string | null };

/** Everyone, and every relationship between two people who are still in the family. */
export async function loadFamily() {
  const [people, rels] = await Promise.all([
    q<{ id: number; name: string; aliases: string[]; thumb_key: string | null; in_memory: boolean; family_friend: boolean; gender: string | null; birth_year: number | null; birth_order: number | null }>(
      `select pe.id, pe.name, pe.aliases, ph.thumb_key, pe.in_memory, pe.family_friend, pe.gender, pe.birth_year, pe.birth_order
         from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
        where pe.deleted_at is null order by lower(pe.name)`),
    q<Rel>(
      `select r.id, r.person_id, r.related_id, r.kind, r.label, r.created_by_device from relationships r
         join people a on a.id = r.person_id and a.deleted_at is null
         join people b on b.id = r.related_id and b.deleted_at is null
        where r.deleted_at is null order by r.id`),
  ]);
  const byId = new Map<number, FPerson>();
  await Promise.all(people.map(async (p) => byId.set(p.id, {
    id: p.id, name: displayName(p.name), aliases: p.aliases ?? [], inMemory: !!p.in_memory, friend: !!p.family_friend,
    gender: p.gender === "female" || p.gender === "male" ? p.gender : null, birthYear: p.birth_year, birthOrder: p.birth_order,
    avatarUrl: p.thumb_key ? await signGet(p.thumb_key) : null,
  })));
  const parentsOf = new Map<number, number[]>(), childrenOf = new Map<number, number[]>(), partnersOf = new Map<number, number[]>(), siblingsOf = new Map<number, number[]>();
  const push = (m: Map<number, number[]>, k: number, v: number) => { const l = m.get(k) ?? []; if (!l.includes(v)) l.push(v); m.set(k, l); };
  for (const r of rels) {
    if (r.kind === "parent") { push(childrenOf, r.person_id, r.related_id); push(parentsOf, r.related_id, r.person_id); }
    else if (r.kind === "partner") { push(partnersOf, r.person_id, r.related_id); push(partnersOf, r.related_id, r.person_id); }
    else if (r.kind === "sibling") { push(siblingsOf, r.person_id, r.related_id); push(siblingsOf, r.related_id, r.person_id); }
  }
  const sortByName = (ids: number[]) => ids.filter((i) => byId.has(i)).sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name));
  // Oldest first: the order Mary set by dragging, then birth year, then name.
  const sortByAge = (ids: number[]) => ids.filter((i) => byId.has(i)).sort((a, b) => {
    const x = byId.get(a)!, y = byId.get(b)!;
    return (x.birthOrder ?? 1e9) - (y.birthOrder ?? 1e9) || (x.birthYear ?? 1e9) - (y.birthYear ?? 1e9) || x.name.localeCompare(y.name);
  });
  const parents = (id: number) => sortByName(parentsOf.get(id) ?? []);
  return {
    people: [...byId.values()], byId, rels, sortByAge,
    parents,
    children: (id: number) => sortByAge(childrenOf.get(id) ?? []),
    partners: (id: number) => sortByName(partnersOf.get(id) ?? []),
    /** Brothers and sisters: linked directly, or sharing a parent. Oldest first. */
    siblings: (id: number) => {
      const viaParents = parents(id).flatMap((p) => childrenOf.get(p) ?? []);
      return sortByAge([...new Set([...(siblingsOf.get(id) ?? []), ...viaParents])].filter((x) => x !== id));
    },
  };
}
export type Family = Awaited<ReturnType<typeof loadFamily>>;

export type TreeNode = { person: FPerson; partners: FPerson[]; children: TreeNode[] };

/** Dunya and everyone descended from her, with partners beside each person. Never loops, even if the data does. */
function descend(f: Family, id: number, seen: Set<number>): TreeNode {
  seen.add(id);
  const partners = f.partners(id).filter((p) => !seen.has(p));
  partners.forEach((p) => seen.add(p));
  const kids = new Set([id, ...partners].flatMap((p) => f.children(p)));
  return {
    person: f.byId.get(id)!,
    partners: partners.map((p) => f.byId.get(p)!),
    children: f.sortByAge([...kids].filter((k) => !seen.has(k))).map((k) => descend(f, k, seen)),
  };
}

export type Elder = FPerson & { role: string };

const roleWord = (g: Gender, female: string, male: string, other: string) => (g === "female" ? female : g === "male" ? male : other);
export const parentWord = (g: Gender) => roleWord(g, "Mother", "Father", "Parent");
export const siblingWord = (g: Gender) => roleWord(g, "Sister", "Brother", "Sibling");
export const childWord = (g: Gender) => roleWord(g, "Daughter", "Son", "Child");

/** Earlier generations: parents, then grandparents, and so on, each with what they are to Dunya. */
function ancestors(f: Family, id: number, seen: Set<number>) {
  const gens: Elder[][] = [];
  let level = [id];
  while (level.length && gens.length < 6) {
    const next = [...new Set(level.flatMap((p) => f.parents(p)))].filter((p) => !seen.has(p));
    if (!next.length) break;
    next.forEach((p) => seen.add(p));
    const depth = gens.length;
    gens.push(next.map((p) => {
      const person = f.byId.get(p)!;
      const word = parentWord(person.gender);
      const role = depth === 0 ? word : `${"Great-".repeat(depth - 1)}grand${word.toLowerCase()}`;
      return { ...person, role: role.charAt(0).toUpperCase() + role.slice(1) };
    }));
    level = next;
  }
  return gens;
}

export type Group = { slug: string; title: string; text: string; people: FPerson[] };

export async function familyTree() {
  const f = await loadFamily();
  const dunya = await findDunya();
  const seen = new Set<number>();
  const tree = dunya && f.byId.has(dunya.id) ? descend(f, dunya.id, seen) : null;
  const earlier = dunya && tree ? ancestors(f, dunya.id, seen) : [];
  // Dunya's brothers and sisters stand beside her, in the earlier generations box.
  const rootSiblings: Elder[] = dunya && tree
    ? f.siblings(dunya.id).filter((x) => !seen.has(x)).map((x) => { seen.add(x); const p = f.byId.get(x)!; return { ...p, role: siblingWord(p.gender) }; })
    : [];

  // Everyone else connected to the tree by any relationship: brothers and sisters, cousins, in-laws' families.
  const extended = new Set<number>();
  if (tree) {
    const queue = [...seen];
    const reached = new Set(queue);
    while (queue.length) {
      const id = queue.shift()!;
      for (const n of [...f.parents(id), ...f.children(id), ...f.partners(id), ...f.siblings(id)]) if (!reached.has(n)) { reached.add(n); queue.push(n); extended.add(n); }
    }
  }
  const placed = (id: number) => seen.has(id) || extended.has(id);
  const list = (ids: Iterable<number>) => [...ids].map((i) => f.byId.get(i)!).sort((a, b) => a.name.localeCompare(b.name));
  const groups: Group[] = [
    { slug: "earlier", title: "Earlier generations", text: "Dunya's parents, grandparents, brothers, and sisters", people: [...earlier.flat(), ...rootSiblings] },
    { slug: "extended", title: "Extended family", text: "Brothers, sisters, cousins, and in-laws", people: list(extended) },
    { slug: "friends", title: "Family friends", text: "Loved ones who are family to us", people: f.people.filter((p) => p.friend && !placed(p.id)) },
    { slug: "unplaced", title: "Not in the tree yet", text: "Add their parents, partner, or children", people: f.people.filter((p) => !p.friend && !placed(p.id)) },
  ];
  return { tree, earlier, rootSiblings, groups, everyone: f.people, rootId: dunya?.id ?? null };
}

/** Photos with anyone in a group: how many, and one to show on the card. */
export async function groupPhotos(ids: number[]) {
  if (!ids.length) return { count: 0, url: null as string | null };
  const [row] = await q<{ n: number; thumb_key: string | null }>(
    `select count(distinct p.id)::int as n,
            (select p2.thumb_key from photos p2 join photo_people x2 on x2.photo_id = p2.id
              where p2.deleted_at is null and x2.person_id = any($1::int[]) order by p2.id desc limit 1) as thumb_key
       from photos p join photo_people x on x.photo_id = p.id where p.deleted_at is null and x.person_id = any($1::int[])`, [ids]);
  return { count: row?.n ?? 0, url: row?.thumb_key ? await signGet(row.thumb_key) : null };
}

export type Relation = { relId: number; person: FPerson; removable: boolean };

/** One person's parents, partners, and children, with whether this viewer can take each link off. */
export async function relationsFor(id: number, s: Session | null) {
  const f = await loadFamily();
  const find = (other: number, kind: "parent" | "partner", parentIsOther?: boolean) => f.rels.find((r) => r.kind === kind && (kind === "partner"
    ? (r.person_id === Math.min(id, other) && r.related_id === Math.max(id, other))
    : parentIsOther ? r.person_id === other && r.related_id === id : r.person_id === id && r.related_id === other));
  const rel = (other: number, kind: "parent" | "partner", parentIsOther?: boolean): Relation | null => {
    const r = find(other, kind, parentIsOther);
    return r ? { relId: r.id, person: f.byId.get(other)!, removable: canRemove(s, r.created_by_device) } : null;
  };
  const keep = (x: (Relation | null)[]) => x.filter((r): r is Relation => !!r);
  return {
    parents: keep(f.parents(id).map((p) => rel(p, "parent", true))),
    partners: keep(f.partners(id).map((p) => rel(p, "partner"))),
    children: keep(f.children(id).map((c) => rel(c, "parent", false))),
    friend: f.byId.get(id)?.friend ?? false,
  };
}

/** Is `maybe` the same as, or descended from, `id`? Used so no one becomes their own ancestor. */
export async function isSelfOrDescendant(id: number, maybe: number) {
  const [row] = await q<{ yes: boolean }>(
    `with recursive d(pid) as (select $1::int union select r.related_id from relationships r join d on r.person_id = d.pid
       where r.kind = 'parent' and r.deleted_at is null)
     select exists (select 1 from d where pid = $2) as yes`, [id, maybe]);
  return !!row?.yes;
}

/** Link two people in the tree. Anyone can add; the other person can be someone new, typed by name. */
export async function addRelation(id: number, kind: "parent" | "child" | "partner", otherRaw: number | string, s: Session): Promise<string | null> {
  const [other] = await resolvePeople([otherRaw], s);
  if (!other) return "Choose someone.";
  if (other === id) return "Someone can't be related to themselves that way.";
  const [both] = await q<{ n: number }>(`select count(*)::int as n from people where id in ($1, $2) and deleted_at is null`, [id, other]);
  if (both?.n !== 2) return "That person isn't in the family anymore.";
  let a = id, b = other;
  if (kind === "parent") { a = other; b = id; } // other is a parent of id
  if (kind === "partner") { a = Math.min(id, other); b = Math.max(id, other); }
  if (kind !== "partner" && (await isSelfOrDescendant(b, a))) return "That would make someone their own ancestor. Check who is the parent and who is the child.";
  if (kind !== "partner") {
    const [linked] = await q(`select 1 from relationships where kind = 'partner' and deleted_at is null and person_id = $1 and related_id = $2`, [Math.min(a, b), Math.max(a, b)]);
    if (linked) return "They're already partners.";
  }
  await q(
    `insert into relationships (person_id, related_id, kind, created_by_device, created_by_name) values ($1, $2, $3, $4, $5)
     on conflict do nothing`, [a, b, kind === "partner" ? "partner" : "parent", s.did, s.name]);
  return null;
}
