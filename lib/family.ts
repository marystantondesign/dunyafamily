import { canRemove } from "./auth";
import { q } from "./db";
import { findDunya } from "./featured";
import { signGet } from "./r2";
import type { Session } from "./session";
import { resolvePeople } from "./tags";

export type FPerson = { id: number; name: string; aliases: string[]; avatarUrl: string | null; inMemory: boolean; friend: boolean };
type Rel = { id: number; person_id: number; related_id: number; kind: "parent" | "partner"; created_by_device: string | null };

/** Everyone, and every relationship between two people who are still in the family. */
export async function loadFamily() {
  const [people, rels] = await Promise.all([
    q<{ id: number; name: string; aliases: string[]; thumb_key: string | null; in_memory: boolean; family_friend: boolean }>(
      `select pe.id, pe.name, pe.aliases, ph.thumb_key, pe.in_memory, pe.family_friend
         from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
        where pe.deleted_at is null order by lower(pe.name)`),
    q<Rel>(
      `select r.id, r.person_id, r.related_id, r.kind, r.created_by_device from relationships r
         join people a on a.id = r.person_id and a.deleted_at is null
         join people b on b.id = r.related_id and b.deleted_at is null
        where r.deleted_at is null order by r.id`),
  ]);
  const byId = new Map<number, FPerson>();
  await Promise.all(people.map(async (p) => byId.set(p.id, {
    id: p.id, name: p.name, aliases: p.aliases ?? [], inMemory: !!p.in_memory, friend: !!p.family_friend,
    avatarUrl: p.thumb_key ? await signGet(p.thumb_key) : null,
  })));
  const parentsOf = new Map<number, number[]>(), childrenOf = new Map<number, number[]>(), partnersOf = new Map<number, number[]>();
  const push = (m: Map<number, number[]>, k: number, v: number) => { const l = m.get(k) ?? []; if (!l.includes(v)) l.push(v); m.set(k, l); };
  for (const r of rels) {
    if (r.kind === "parent") { push(childrenOf, r.person_id, r.related_id); push(parentsOf, r.related_id, r.person_id); }
    else if (r.kind === "partner") { push(partnersOf, r.person_id, r.related_id); push(partnersOf, r.related_id, r.person_id); }
  }
  const sortByName = (ids: number[]) => ids.filter((i) => byId.has(i)).sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name));
  return {
    people: [...byId.values()], byId, rels,
    parents: (id: number) => sortByName(parentsOf.get(id) ?? []),
    children: (id: number) => sortByName(childrenOf.get(id) ?? []),
    partners: (id: number) => sortByName(partnersOf.get(id) ?? []),
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
    children: [...kids].filter((k) => !seen.has(k)).sort((a, b) => f.byId.get(a)!.name.localeCompare(f.byId.get(b)!.name)).map((k) => descend(f, k, seen)),
  };
}

/** Earlier generations: parents (with their partners), then grandparents, and so on. */
function ancestors(f: Family, id: number, seen: Set<number>) {
  const gens: FPerson[][] = [];
  let level = [id];
  while (level.length && gens.length < 6) {
    const next = [...new Set(level.flatMap((p) => f.parents(p)))].filter((p) => !seen.has(p));
    if (!next.length) break;
    next.forEach((p) => seen.add(p));
    gens.push(next.map((p) => f.byId.get(p)!));
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

  // Everyone else connected to the tree by any relationship: brothers and sisters, cousins, in-laws' families.
  const extended = new Set<number>();
  if (tree) {
    const queue = [...seen];
    const reached = new Set(queue);
    while (queue.length) {
      const id = queue.shift()!;
      for (const n of [...f.parents(id), ...f.children(id), ...f.partners(id)]) if (!reached.has(n)) { reached.add(n); queue.push(n); extended.add(n); }
    }
  }
  const placed = (id: number) => seen.has(id) || extended.has(id);
  const list = (ids: Iterable<number>) => [...ids].map((i) => f.byId.get(i)!).sort((a, b) => a.name.localeCompare(b.name));
  const groups: Group[] = [
    { slug: "earlier", title: "Earlier generations", text: "Dunya's parents, grandparents, and before", people: earlier.flat() },
    { slug: "extended", title: "Extended family", text: "Brothers, sisters, cousins, and in-laws", people: list(extended) },
    { slug: "friends", title: "Family friends", text: "Loved ones who are family to us", people: f.people.filter((p) => p.friend && !placed(p.id)) },
    { slug: "unplaced", title: "Not in the tree yet", text: "Add their parents, partner, or children", people: f.people.filter((p) => !p.friend && !placed(p.id)) },
  ];
  return { tree, earlier, groups, everyone: f.people, rootId: dunya?.id ?? null };
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
