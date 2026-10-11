import { q } from "./db";
import { byName, displayName } from "./names";
import { monthDay } from "./people";
import { signGet } from "./r2";

export const RESTORABLE = ["photo", "person", "album", "birthday", "gathering", "date", "relationship"] as const;
export type DeletedType = (typeof RESTORABLE)[number];
export type DeletedItem = {
  type: DeletedType; id: number; title: string; sub: string; deletedAt: string; deletedBy: string | null; thumbUrl: string | null;
};

const DAYS = 30;
const recent = (t: string) => `${t}.deleted_at is not null and ${t}.deleted_at > now() - interval '${DAYS} days'`;

/** Everything removed in the last 30 days, newest first. Older things are still in the database, just not listed. */
export async function listDeleted(): Promise<DeletedItem[]> {
  const [photos, people, albums, birthdays, gatherings, dates, rels] = await Promise.all([
    q<{ id: number; thumb_key: string; year: number | null; uploaded_by_name: string | null; deleted_at: string; deleted_by_name: string | null }>(
      `select p.id, p.thumb_key, p.year, p.uploaded_by_name, p.deleted_at, p.deleted_by_name from photos p where ${recent("p")}`),
    q<{ id: number; name: string; deleted_at: string; deleted_by_name: string | null }>(
      `select pe.id, pe.name, pe.deleted_at, pe.deleted_by_name from people pe where ${recent("pe")}`),
    q<{ id: number; title: string; deleted_at: string; deleted_by_name: string | null }>(
      `select a.id, a.title, a.deleted_at, a.deleted_by_name from albums a where ${recent("a")}`),
    // A birthday that was changed is saved as a new one, so only list it if the person has none now.
    q<{ id: number; name: string; month: number; day: number; year: number | null; deleted_at: string; deleted_by_name: string | null }>(
      `select b.id, pe.name, b.month, b.day, b.year, b.deleted_at, b.deleted_by_name from birthdays b join people pe on pe.id = b.person_id
        where ${recent("b")} and not exists (select 1 from birthdays b2 where b2.person_id = b.person_id and b2.deleted_at is null)`),
    q<{ id: number; title: string; date: string; deleted_at: string; deleted_by_name: string | null }>(
      `select g.id, g.title, g.date::text as date, g.deleted_at, g.deleted_by_name from gatherings g where ${recent("g")}`),
    q<{ id: number; name: string; label: string; month: number; day: number; deleted_at: string; deleted_by_name: string | null }>(
      `select d.id, pe.name, d.label, d.month, d.day, d.deleted_at, d.deleted_by_name from person_dates d join people pe on pe.id = d.person_id where ${recent("d")}`),
    q<{ id: number; kind: string; a: string; b: string; deleted_at: string; deleted_by_name: string | null }>(
      `select r.id, r.kind, pa.name as a, pb.name as b, r.deleted_at, r.deleted_by_name from relationships r
         join people pa on pa.id = r.person_id join people pb on pb.id = r.related_id where ${recent("r")}`),
  ]);
  const items: DeletedItem[] = [
    ...(await Promise.all(photos.map(async (p) => ({
      type: "photo" as const, id: p.id, title: p.year ? `Photo from ${p.year}` : "Photo", sub: `Added by ${byName(p.uploaded_by_name)}`,
      deletedAt: p.deleted_at, deletedBy: p.deleted_by_name ? displayName(p.deleted_by_name) : null, thumbUrl: await signGet(p.thumb_key),
    })))),
    ...people.map((p) => ({ type: "person" as const, id: p.id, title: displayName(p.name), sub: "Person. Their photo tags come back too.", deletedAt: p.deleted_at, deletedBy: p.deleted_by_name ? displayName(p.deleted_by_name) : null, thumbUrl: null })),
    ...albums.map((a) => ({ type: "album" as const, id: a.id, title: a.title, sub: "Album", deletedAt: a.deleted_at, deletedBy: a.deleted_by_name ? displayName(a.deleted_by_name) : null, thumbUrl: null })),
    ...birthdays.map((b) => ({ type: "birthday" as const, id: b.id, title: `${displayName(b.name)}'s birthday`, sub: monthDay(b.month, b.day, b.year), deletedAt: b.deleted_at, deletedBy: b.deleted_by_name ? displayName(b.deleted_by_name) : null, thumbUrl: null })),
    ...gatherings.map((g) => ({
      type: "gathering" as const, id: g.id, title: g.title,
      sub: `Gathering, ${new Date(`${g.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      deletedAt: g.deleted_at, deletedBy: g.deleted_by_name ? displayName(g.deleted_by_name) : null, thumbUrl: null,
    })),
    ...dates.map((d) => ({ type: "date" as const, id: d.id, title: d.label || `${displayName(d.name)}'s date`, sub: `${displayName(d.name)}, ${monthDay(d.month, d.day)}`, deletedAt: d.deleted_at, deletedBy: d.deleted_by_name ? displayName(d.deleted_by_name) : null, thumbUrl: null })),
    ...rels.map((r) => ({
      type: "relationship" as const, id: r.id, title: r.kind === "partner" ? `${displayName(r.a)} and ${displayName(r.b)}` : `${displayName(r.a)}, parent of ${displayName(r.b)}`,
      sub: r.kind === "partner" ? "Partners, in the family tree" : "In the family tree", deletedAt: r.deleted_at, deletedBy: r.deleted_by_name ? displayName(r.deleted_by_name) : null, thumbUrl: null,
    })),
  ];
  return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

const TABLE: Record<DeletedType, string> = {
  photo: "photos", person: "people", album: "albums", birthday: "birthdays", gathering: "gatherings", date: "person_dates", relationship: "relationships",
};

/** Put something back. Returns a reason when it can't come back as it was. */
export async function restore(type: DeletedType, id: number): Promise<string | null> {
  const table = TABLE[type];
  const [row] = await q<{ id: number }>(`select id from ${table} where id = $1 and deleted_at is not null`, [id]);
  if (!row) return "That's already back.";
  if (type === "person") {
    const [twin] = await q<{ name: string }>(
      `select b.name from people a join people b on lower(b.name) = lower(a.name) and b.deleted_at is null and b.id <> a.id where a.id = $1`, [id]);
    if (twin) return `Someone named ${twin.name} is already in the family. Rename or remove them first.`;
  }
  if (type === "birthday") {
    const [other] = await q(`select 1 from birthdays b join birthdays a on a.person_id = b.person_id where a.id = $1 and b.deleted_at is null`, [id]);
    if (other) return "They already have a birthday saved.";
    const [gone] = await q(`select 1 from birthdays b join people pe on pe.id = b.person_id where b.id = $1 and pe.deleted_at is not null`, [id]);
    if (gone) return "Restore the person first.";
  }
  if (type === "date") {
    const [gone] = await q(`select 1 from person_dates d join people pe on pe.id = d.person_id where d.id = $1 and pe.deleted_at is not null`, [id]);
    if (gone) return "Restore the person first.";
  }
  if (type === "relationship") {
    const [dup] = await q(
      `select 1 from relationships a join relationships b on b.kind = a.kind and b.person_id = a.person_id and b.related_id = a.related_id and b.deleted_at is null
        where a.id = $1`, [id]);
    if (dup) {
      // Someone already added the same link again, so there's nothing to bring back.
      return "That link is already in the tree.";
    }
  }
  await q(`update ${table} set deleted_at = null, deleted_by_name = null where id = $1`, [id]);
  return null;
}
