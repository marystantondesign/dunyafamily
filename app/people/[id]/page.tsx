import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Gallery } from "@/components/Gallery";
import { q } from "@/lib/db";
import { birthdays, listPeople } from "@/lib/data";
import { findPhotos, type Photo } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const person = (await listPeople()).find((p) => p.id === id);
  if (!person) notFound();

  const [photos, bdays, often] = await Promise.all([
    findPhotos({ people: [id] }, { order: "oldest", limit: 1000 }),
    birthdays(),
    q<{ id: number; name: string; n: number }>(
      `select pe.id, pe.name, count(*)::int as n
         from photo_people a
         join photo_people b on b.photo_id = a.photo_id and b.person_id <> a.person_id
         join people pe on pe.id = b.person_id and pe.deleted_at is null
         join photos ph on ph.id = a.photo_id and ph.deleted_at is null
        where a.person_id = $1 group by pe.id, pe.name order by n desc limit 6`,
      [id],
    ),
  ]);
  const bday = bdays.find((b) => b.person_id === id);

  // Group into decades so the page reads like watching them grow up.
  const groups = new Map<string, Photo[]>();
  for (const p of photos) {
    const d = p.decade ?? (p.year ? Math.floor(p.year / 10) * 10 : null);
    const key = d ? `${d}s` : "Date unknown";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  return (
    <>
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginTop: 32, flexWrap: "wrap" }}>
        <Avatar name={person.name} url={person.avatar_url} size="lg" />
        <div>
          <h1 className="display">{person.name}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {photos.length} {photos.length === 1 ? "photo" : "photos"}
            {bday && <> · Birthday {new Date(2000, bday.month - 1, bday.day).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</>}
          </p>
        </div>
      </div>

      {often.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 className="small muted" style={{ marginBottom: 8 }}>Often photographed with</h2>
          <div className="pills">
            {often.map((o) => (
              <Link key={o.id} className="pill" href={`/browse?people=${id},${o.id}`}>{o.name} <span className="muted">{o.n}</span></Link>
            ))}
          </div>
        </section>
      )}

      {[...groups.entries()].map(([label, list]) => (
        <div key={label} className="decade">
          <h2>{label}</h2>
          <Gallery photos={list} showWhen query={`people=${id}&order=oldest`} />
        </div>
      ))}
      {!photos.length && <p className="muted" style={{ marginTop: 32 }}>No photos of {person.name} yet.</p>}
    </>
  );
}
