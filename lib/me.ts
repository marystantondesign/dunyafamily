import { q } from "./db";
import { displayName } from "./names";
import { signGet } from "./r2";
import type { Session } from "./session";
import { familyOrder } from "./familyOrder";
import { canSignIn, signInIds } from "./signin";

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

/**
 * People who can sign in, for the sign-in picker: those with "Can sign in" on (lib/signin), in family order,
 * then anyone else switched on (like Abe) A to Z.
 */
export async function pickablePeople() {
  const [allowed, order] = await Promise.all([signInIds(), familyOrder()]);
  if (!allowed.size) return [];
  const rows = await q<{ id: number; name: string; thumb_key: string | null }>(
    `select pe.id, pe.name, ph.thumb_key from people pe left join photos ph on ph.id = pe.avatar_photo_id and ph.deleted_at is null
      where pe.id = any($1::int[]) order by lower(pe.name)`, [[...allowed]]);
  const rank = new Map(order.map((id, i) => [id, i]));
  rows.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
  return Promise.all(rows.map(async (r) => ({ id: r.id, name: displayName(r.name), avatarUrl: r.thumb_key ? await signGet(r.thumb_key) : null })));
}

/** The person this device picked. Only someone who can sign in; nobody new is ever added here. */
export async function resolveMe(body: { personId?: number }): Promise<{ id: number; name: string } | { error: string }> {
  const id = Number(body.personId);
  if (!Number.isInteger(id) || id <= 0) return { error: "Pick your name to keep going." };
  if (!(await canSignIn(id))) return { error: "That name can't sign in. Ask Mary if you think it should." };
  const [p] = await q<{ id: number; name: string }>(`select id, name from people where id = $1 and deleted_at is null`, [id]);
  return p ?? { error: "That person isn't on the list anymore. Pick again." };
}
