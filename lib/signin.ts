import { cache } from "react";
import { q } from "./db";
import { findDunya } from "./featured";
import type { Family } from "./family";

/** Dunya, her descendants, and her brothers and sisters. */
export function bloodRelatives(f: Family, rootId: number): Set<number> {
  const out = new Set([rootId]);
  const walk = (id: number) => { for (const c of f.children(id)) if (!out.has(c)) { out.add(c); walk(c); } };
  walk(rootId);
  for (const s of f.siblings(rootId)) out.add(s);
  return out;
}

/** The same people as bloodRelatives, straight from the database (this runs on every page, so no photo links). */
const BLOOD = `with recursive d(id) as (
    select $1::int
    union select r.related_id from relationships r join d on r.person_id = d.id where r.kind = 'parent' and r.deleted_at is null
  )
  select id from d
  union select k.related_id from relationships p join relationships k on k.person_id = p.person_id and k.kind = 'parent' and k.deleted_at is null
         where p.kind = 'parent' and p.related_id = $1 and p.deleted_at is null
  union select case when r.person_id = $1 then r.related_id else r.person_id end from relationships r
         where r.kind = 'sibling' and r.deleted_at is null and $1 in (r.person_id, r.related_id)`;

/** Abe was switched on by hand when "Can sign in" arrived (round 15). Done once, and only if there's one Abe. */
async function abeOnce() {
  const [done] = await q(`select 1 from settings where key = 'can_sign_in_seeded'`);
  if (done) return;
  await q(`update people set can_sign_in = true where can_sign_in is null and not in_memory and id = (
             select min(id) from people where deleted_at is null and not in_memory and split_part(lower(name), ' ', 1) = 'abe'
             having count(*) = 1)`);
  await q(`insert into settings (key, value) values ('can_sign_in_seeded', '1') on conflict (key) do nothing`);
}

/**
 * Who may sign in: "Can sign in" when the admin has set it, otherwise on for living blood relatives of Dunya and
 * off for everyone else. Anyone in memory, never. Only the admin edits the tree, so only the admin can make
 * someone a blood relative. `only` narrows the check to one person.
 */
async function allowed(only?: number): Promise<Set<number>> {
  await abeOnce().catch(() => undefined);
  const dunya = await findDunya();
  const rows = await q<{ id: number }>(
    `select pe.id from people pe
      where pe.deleted_at is null and not pe.in_memory and ($2::int is null or pe.id = $2)
        and coalesce(pe.can_sign_in, pe.id in (${BLOOD}))`, [dunya?.id ?? 0, only ?? null]);
  return new Set(rows.map((r) => r.id));
}

export const signInIds = cache(() => allowed());

export const canSignIn = cache(async (pid: number | null | undefined) => !!pid && (await allowed(pid)).has(pid));
