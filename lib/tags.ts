import { q } from "./db";
import type { Session } from "./session";

import { displayName } from "./names";

/** "aunt rose" becomes "Aunt Rose". Leaves the rest of each word alone, so "McKay" stays "McKay". */
export const capitalizeName = displayName;

/** Accepts existing ids (numbers) or new names (strings). Returns ids, creating people as needed. */
export async function resolvePeople(items: (number | string)[], s: Session) {
  const ids: number[] = [];
  for (const item of items) {
    if (typeof item === "number") ids.push(item);
    else if (item.trim()) {
      const name = capitalizeName(item.trim().replace(/\s+/g, " ").slice(0, 80));
      const [existing] = await q<{ id: number }>(
        `select id from people where deleted_at is null and (lower(name) = lower($1) or lower($1) = any(select lower(a) from unnest(aliases) a))`,
        [name],
      );
      if (existing) ids.push(existing.id);
      else {
        const [row] = await q<{ id: number }>(
          `insert into people (name, created_by_device, created_by_name) values ($1, $2, $3) returning id`,
          [name, s.did, s.name],
        );
        ids.push(row.id);
      }
    }
  }
  return [...new Set(ids)];
}

export async function resolveOccasions(items: (number | string)[], s: Session) {
  const ids: number[] = [];
  for (const item of items) {
    if (typeof item === "number") ids.push(item);
    else if (item.trim()) {
      const name = item.trim().slice(0, 60);
      const [row] = await q<{ id: number }>(
        `insert into occasions (name, created_by_device) values ($1, $2)
         on conflict (lower(name)) do update set name = occasions.name returning id`,
        [name, s.did],
      );
      ids.push(row.id);
    }
  }
  return [...new Set(ids)];
}

/**
 * "Who's here?" remembers who each signed-in person tagged most recently, for the next photo they tag. The
 * last person in the list counts as the most recent. Never stops a save.
 */
export async function noteRecent(s: Session, personIds: number[]) {
  if (!s.pid || !personIds.length) return;
  await q(
    `insert into tag_recent (tagger_id, person_id, at)
     select $1, p, now() + (n * interval '1 microsecond') from unnest($2::int[]) with ordinality as t(p, n)
     on conflict (tagger_id, person_id) do update set at = excluded.at`,
    [s.pid, personIds],
  ).catch(() => undefined);
}
