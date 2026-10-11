import { q } from "./db";
import { childWord, isSelfOrDescendant, loadFamily, parentWord, siblingWord, type FPerson, type Gender } from "./family";
import type { Session } from "./session";
import { resolvePeople } from "./tags";

/** What someone can be to the person being edited, as picked in "is Dunya's ...". */
export const ROLES = ["mother", "father", "parent", "sister", "brother", "sibling", "partner", "spouse", "daughter", "son", "child"] as const;
export type Role = (typeof ROLES)[number];

const genderOf = (r: Role): Gender | undefined =>
  ["mother", "sister", "daughter"].includes(r) ? "female" : ["father", "brother", "son"].includes(r) ? "male" : ["parent", "sibling", "child"].includes(r) ? null : undefined;
const kindOf = (r: Role) => (["mother", "father", "parent"].includes(r) ? "parent" : ["sister", "brother", "sibling"].includes(r) ? "sibling" : ["partner", "spouse"].includes(r) ? "partner" : "child");

/** "1955", or a full date like "1955-03-09" or "March 9, 1955". */
export function parseBirth(raw: string): { year: number; month?: number; day?: number } | null {
  const t = raw.trim();
  if (/^\d{4}$/.test(t)) return { year: Number(t) };
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const d = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(t);
  if (isNaN(d.getTime()) || d.getFullYear() < 1800) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export async function setBirth(personId: number, raw: string, s: Session): Promise<string | null> {
  if (!raw.trim()) { await q(`update people set birth_year = null where id = $1`, [personId]); return null; }
  const b = parseBirth(raw);
  if (!b || b.year > new Date().getFullYear()) return "Use a year like 1955, or a full date.";
  await q(`update people set birth_year = $1 where id = $2`, [b.year, personId]);
  // A full date also fills in their birthday, if they don't have one yet.
  const [bday] = await q<{ id: number; year: number | null }>(`select id, year from birthdays where person_id = $1 and deleted_at is null`, [personId]);
  if (!bday && b.month && b.day)
    await q(`insert into birthdays (person_id, month, day, year, created_by_device, created_by_name) values ($1, $2, $3, $4, $5, $6)`, [personId, b.month, b.day, b.year, s.did, s.name]);
  else if (bday && bday.year === null) await q(`update birthdays set year = $1 where id = $2`, [b.year, bday.id]);
  return null;
}

async function link(a: number, b: number, kind: "parent" | "partner" | "sibling", s: Session, label: string | null = null) {
  if (kind !== "parent") [a, b] = [Math.min(a, b), Math.max(a, b)];
  await q(`insert into relationships (person_id, related_id, kind, label, created_by_device, created_by_name) values ($1, $2, $3, $4, $5, $6) on conflict do nothing`,
    [a, b, kind, label, s.did, s.name]);
}

/** Connect someone (existing, or new by name) to the person being edited. */
export async function connect(personId: number, otherRaw: number | string, role: Role, birth: string, s: Session): Promise<string | null> {
  const [other] = await resolvePeople([otherRaw], s);
  if (!other) return "Choose someone, or type a new name.";
  if (other === personId) return "Someone can't be connected to themselves.";
  const f = await loadFamily();
  if (!f.byId.has(personId) || !f.byId.has(other)) return "That person isn't in the family anymore.";
  const kind = kindOf(role);

  if (kind === "parent" || kind === "child") {
    const [parent, child] = kind === "parent" ? [other, personId] : [personId, other];
    if (await isSelfOrDescendant(child, parent)) return "That would make someone their own ancestor. Check who is the parent and who is the child.";
    await link(parent, child, "parent", s);
    // A new parent belongs to brothers and sisters too.
    if (kind === "parent")
      for (const sib of f.siblings(personId))
        if (sib !== other && !(await isSelfOrDescendant(sib, other)) && f.parents(sib).length < 2) await link(other, sib, "parent", s);
  } else if (kind === "sibling") {
    await link(personId, other, "sibling", s);
    // Brothers and sisters share parents.
    for (const p of f.parents(personId)) if (p !== other && !(await isSelfOrDescendant(other, p))) await link(p, other, "parent", s);
  } else {
    await link(personId, other, "partner", s, role === "spouse" ? "spouse" : "partner");
  }
  const g = genderOf(role);
  if (g !== undefined) await q(`update people set gender = $1 where id = $2`, [g, other]);
  if (birth.trim()) return setBirth(other, birth, s);
  return null;
}

/** Change the word: mother or father, sister or brother, daughter or son, spouse or partner. */
export async function setRole(personId: number, otherId: number, role: Role) {
  const g = genderOf(role);
  if (g !== undefined) await q(`update people set gender = $1 where id = $2`, [g, otherId]);
  if (role === "spouse" || role === "partner")
    await q(`update relationships set label = $1 where kind = 'partner' and deleted_at is null and person_id = $2 and related_id = $3`,
      [role, Math.min(personId, otherId), Math.max(personId, otherId)]);
}

/** Children's order, oldest first, from dragging. */
export async function setOrder(ids: number[]) {
  for (const [i, id] of ids.entries()) await q(`update people set birth_order = $1 where id = $2`, [i, id]);
}

/** Take a connection off. Both people stay in the family; the link goes to Recently deleted. */
export async function disconnect(personId: number, otherId: number, kind: "parent" | "child" | "partner" | "sibling", s: Session) {
  const del = (where: string, params: unknown[]) =>
    q(`update relationships set deleted_at = now(), deleted_by_name = $${params.length + 1} where deleted_at is null and ${where}`, [...params, s.name]);
  if (kind === "parent") await del(`kind = 'parent' and person_id = $1 and related_id = $2`, [otherId, personId]);
  else if (kind === "child") await del(`kind = 'parent' and person_id = $1 and related_id = $2`, [personId, otherId]);
  else if (kind === "partner") await del(`kind = 'partner' and person_id = $1 and related_id = $2`, [Math.min(personId, otherId), Math.max(personId, otherId)]);
  else {
    await del(`kind = 'sibling' and person_id = $1 and related_id = $2`, [Math.min(personId, otherId), Math.max(personId, otherId)]);
    // They were siblings through shared parents: those parents come off the other person.
    const f = await loadFamily();
    const shared = f.parents(personId).filter((p) => f.parents(otherId).includes(p));
    if (shared.length) await del(`kind = 'parent' and related_id = $1 and person_id = any($2::int[])`, [otherId, shared]);
  }
}

export type Row = { person: FPerson; role: string; label?: string };

/** Everything the editor shows for one person. */
export async function editData(personId: number) {
  const f = await loadFamily();
  const me = f.byId.get(personId);
  if (!me) return null;
  const partnerLabel = (other: number) =>
    f.rels.find((r) => r.kind === "partner" && r.person_id === Math.min(personId, other) && r.related_id === Math.max(personId, other))?.label === "spouse" ? "spouse" : "partner";
  const g = (id: number) => f.byId.get(id)!;
  return {
    person: me,
    parents: f.parents(personId).map((id): Row => ({ person: g(id), role: parentWord(g(id).gender).toLowerCase() })),
    siblings: f.siblings(personId).map((id): Row => ({ person: g(id), role: siblingWord(g(id).gender).toLowerCase() })),
    partners: f.partners(personId).map((id): Row => ({ person: g(id), role: partnerLabel(id) })),
    children: f.children(personId).map((id): Row => ({ person: g(id), role: childWord(g(id).gender).toLowerCase() })),
    everyone: f.people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, avatarUrl: p.avatarUrl, inMemory: p.inMemory })),
  };
}
