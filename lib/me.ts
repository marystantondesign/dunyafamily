import { q } from "./db";
import { displayName } from "./names";
import { signGet } from "./r2";
import type { Session } from "./session";
import { capitalizeName } from "./tags";

export type Me = { pid: number | null; name: string; avatarUrl: string | null; role: Session["role"] };

/** Who this device is, with their current name and profile photo (names can change after someone picks themselves). */
export async function whoAmI(s: Session): Promise<Me> {
  if (s.pid) {
    const [p] = await q<{ name: string; thumb_key: string | null }>(
      `select pe.name, ph.thumb_key from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
        where pe.id = $1 and pe.deleted_at is null`, [s.pid]);
    if (p) return { pid: s.pid, name: displayName(p.name), avatarUrl: p.thumb_key ? await signGet(p.thumb_key) : null, role: s.role };
  }
  return { pid: null, name: displayName(s.name), avatarUrl: null, role: s.role };
}

/** People someone can pick as themselves: everyone in the family except those in memory. */
export async function pickablePeople() {
  const rows = await q<{ id: number; name: string; thumb_key: string | null }>(
    `select pe.id, pe.name, ph.thumb_key from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where pe.deleted_at is null and not pe.in_memory order by lower(pe.name)`,
  );
  return Promise.all(rows.map(async (r) => ({ id: r.id, name: displayName(r.name), avatarUrl: r.thumb_key ? await signGet(r.thumb_key) : null })));
}

/** The person this device picked, or a new person for "I'm not on the list yet". */
export async function resolveMe(body: { personId?: number; newName?: string }, did: string): Promise<{ id: number; name: string } | { error: string }> {
  if (body.personId) {
    const [p] = await q<{ id: number; name: string }>(
      `select id, name from people where id = $1 and deleted_at is null and not in_memory`, [Number(body.personId)]);
    return p ?? { error: "That person isn't on the list anymore. Pick again." };
  }
  const name = capitalizeName((body.newName ?? "").trim().replace(/\s+/g, " ").slice(0, 80));
  if (!name) return { error: "Choose who you are, or add your name." };
  const [existing] = await q<{ id: number; name: string }>(
    `select id, name from people where deleted_at is null and (lower(name) = lower($1) or lower($1) = any(select lower(a) from unnest(aliases) a))`, [name]);
  if (existing) return existing;
  const [row] = await q<{ id: number }>(`insert into people (name, created_by_device, created_by_name) values ($1, $2, $1) returning id`, [name, did]);
  return { id: row.id, name };
}
