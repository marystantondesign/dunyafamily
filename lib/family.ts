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
  /** Had a child with a family member but isn't family: small on the tree, on the line to the children they share. */
  coparent: boolean;
  gender: Gender; birthYear: number | null; birthOrder: number | null;
  /** Birth year, or the year on their birthday if that is all we have. Shown as "b. 1955" and used for oldest first. */
  year: number | null;
};
type Rel = { id: number; person_id: number; related_id: number; kind: "parent" | "partner" | "sibling"; label: string | null; created_by_device: string | null };

/** Everyone, and every relationship between two people who are still in the family. */
export async function loadFamily() {
  const [people, rels] = await Promise.all([
    q<{ id: number; name: string; aliases: string[]; thumb_key: string | null; in_memory: boolean; family_friend: boolean; is_coparent: boolean; gender: string | null; birth_year: number | null; birth_order: number | null; known_year: number | null }>(
      `select pe.id, pe.name, pe.aliases, ph.thumb_key, pe.in_memory, pe.family_friend, coalesce(pe.is_coparent, false) as is_coparent, pe.gender, pe.birth_year, pe.birth_order,
              coalesce(pe.birth_year, (select b.year from birthdays b where b.person_id = pe.id and b.deleted_at is null and b.year is not null order by b.id desc limit 1)) as known_year
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
    id: p.id, name: displayName(p.name), aliases: p.aliases ?? [], inMemory: !!p.in_memory, friend: !!p.family_friend, coparent: !!p.is_coparent,
    gender: p.gender === "female" || p.gender === "male" ? p.gender : null, birthYear: p.birth_year, birthOrder: p.birth_order, year: p.known_year,
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
  // Oldest first: everyone with a birth year (or a year on their birthday) by year, then anyone without one in the
  // order Mary set by dragging, then by name.
  const sortByAge = (ids: number[]) => ids.filter((i) => byId.has(i)).sort((a, b) => {
    const x = byId.get(a)!, y = byId.get(b)!;
    if (x.year != null && y.year != null) return x.year - y.year || (x.birthOrder ?? 1e9) - (y.birthOrder ?? 1e9) || x.name.localeCompare(y.name);
    if (x.year != null || y.year != null) return x.year != null ? -1 : 1;
    return (x.birthOrder ?? 1e9) - (y.birthOrder ?? 1e9) || x.name.localeCompare(y.name);
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

/** A partner beside someone, with what they are: Husband, Wife, Former husband, Partner, Former partner. */
export type TreePartner = { person: FPerson; label: string };
/** Someone's children with one other parent (or none recorded), oldest first. */
export type KidGroup = {
  partner: FPerson | null; label: string; children: TreeNode[];
  /**
   * Drawn as a co-parent: smallest, on this group's own drop line. True when the other parent is marked co-parent,
   * or when the person has children with more than one other parent (or some with none recorded), so each pair's
   * children are clearly theirs. A single partner with children together stands beside the person instead.
   */
  coparent: boolean;
};
export type TreeNode = {
  person: FPerson;
  /** Partners with no children together: shown beside the person. */
  partners: TreePartner[];
  /** Children grouped by their other parent, in the order of each group's oldest child. */
  groups: KidGroup[];
  /** Every child, oldest first within each group (for the phone list). */
  children: TreeNode[];
};

/** "spouse" reads as Husband or Wife, "former_spouse" as Former husband or wife, and so on. */
export function partnerLabel(label: string | null | undefined, g: Gender) {
  const spouse = g === "female" ? "wife" : g === "male" ? "husband" : "spouse";
  return label === "spouse" ? spouse.charAt(0).toUpperCase() + spouse.slice(1)
    : label === "former_spouse" ? `Former ${spouse}`
    : label === "former_partner" ? "Former partner" : "Partner";
}

/**
 * Dunya and everyone descended from her. Each person's children are grouped by their other parent, so children
 * with different partners sit apart. Partners with no children together stand beside the person. Never loops.
 */
function descend(f: Family, id: number, seen: Set<number>, root = false): TreeNode {
  seen.add(id);
  const partnerIds = f.partners(id).filter((p) => !seen.has(p));
  partnerIds.forEach((p) => seen.add(p));
  const label = (other: number) => f.rels.find((r) => r.kind === "partner" && r.person_id === Math.min(id, other) && r.related_id === Math.max(id, other))?.label;

  // Group this person's children, and any children of their partners, by the other parent.
  const byParent = new Map<number | null, number[]>();
  const put = (kid: number, other: number | null) => { if (!byParent.has(other)) byParent.set(other, []); byParent.get(other)!.push(kid); };
  const placed = new Set<number>();
  // A couple's children are drawn from the dash between them. When a child's second parent isn't recorded but this
  // person has exactly one partner (and that partner isn't marked a co-parent), the child is taken to be the couple's:
  // families often add the spouse and the children without linking the spouse to each child.
  const couplePartner = partnerIds.length === 1 && !f.byId.get(partnerIds[0])?.coparent ? partnerIds[0] : null;
  for (const kid of f.children(id)) {
    if (seen.has(kid)) continue;
    const others = f.parents(kid).filter((p) => p !== id);
    put(kid, others.find((p) => partnerIds.includes(p)) ?? others[0] ?? (root ? null : couplePartner));
    placed.add(kid);
  }
  for (const p of partnerIds) for (const kid of f.children(p)) if (!seen.has(kid) && !placed.has(kid)) { put(kid, p); placed.add(kid); }

  const groups: KidGroup[] = [...byParent.entries()].map(([other, kids]) => {
    if (other !== null) seen.add(other);
    return { partner: other !== null ? f.byId.get(other) ?? null : null, kids: f.sortByAge(kids) };
  })
    // Groups go in the order of their oldest child.
    .sort((a, b) => f.sortByAge([a.kids[0], b.kids[0]])[0] === a.kids[0] ? -1 : 1)
    .map((g) => ({
      partner: g.partner, coparent: !!g.partner?.coparent,
      label: g.partner && !g.partner.coparent ? partnerLabel(label(g.partner.id), g.partner.gender) : "",
      children: g.kids.filter((k) => !seen.has(k)).map((k) => descend(f, k, seen)),
    }));

  // Several groups: every other parent goes on their own drop line. Dunya's groups stay as cards.
  if (!root && groups.length > 1) for (const g of groups) if (g.partner) g.coparent = true;
  if (root) for (const g of groups) g.coparent = false;
  const inGroups = new Set(groups.map((g) => g.partner?.id).filter((x): x is number => x != null));
  return {
    person: f.byId.get(id)!,
    // A co-parent with no children recorded together isn't shown beside them as a partner.
    partners: partnerIds.filter((p) => !inGroups.has(p) && !f.byId.get(p)!.coparent).map((p) => ({ person: f.byId.get(p)!, label: partnerLabel(label(p), f.byId.get(p)!.gender) })),
    groups,
    children: groups.flatMap((g) => g.children),
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
  const tree = dunya && f.byId.has(dunya.id) ? descend(f, dunya.id, seen, true) : null;
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
