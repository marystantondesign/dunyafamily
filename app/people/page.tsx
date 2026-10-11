import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { FamilyTree } from "@/components/FamilyTree";
import { familyTree, groupPhotos } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function People() {
  const { tree, earlier, groups, everyone } = await familyTree();
  const cards = await Promise.all(groups.filter((g) => g.people.length).map(async (g) => ({ ...g, photos: await groupPhotos(g.people.map((p) => p.id)) })));
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <>
      <div className="page-head">
        <h1 className="display">Our family</h1>
        <p className="lede">Rooted in Dunya. Growing through generations.</p>
      </div>

      <FamilyTree tree={tree} earlier={earlier} everyone={everyone.map(({ id, name }) => ({ id, name }))} />

      {cards.length > 0 && (
        <section className="family-groups">
          <div className="section-head">
            <h2 className="section-title">More family &amp; loved ones</h2>
            <a href="#everyone" className="text-link small">View all <span aria-hidden="true">›</span></a>
          </div>
          <div className="group-grid">
            {cards.map((g) => (
              <Link key={g.slug} href={`/people/group/${g.slug}`} className="group-card">
                <span className="group-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {g.photos.url && <img src={g.photos.url} alt="" loading="lazy" />}
                </span>
                <span className="group-title">{g.title}</span>
                <span className="small muted">{plural(g.people.length, "person", "people")}{g.photos.count ? `, ${plural(g.photos.count, "photo", "photos")}` : ""}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="everyone" className="family-everyone">
        <div className="section-head">
          <h2 className="section-title">Everyone</h2>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link href="/people/addresses" className="btn">Address book</Link>
            <Link href="/people/new" className="btn btn-primary">+ Add someone</Link>
          </div>
        </div>
        <div className="people">
          {everyone.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`} className="person">
              <Avatar name={p.name} url={p.avatarUrl} />
              <span className="person-label">{p.name}</span>
              {p.inMemory && <span className="in-memory small">In memory</span>}
            </Link>
          ))}
        </div>
        {!everyone.length && <p className="muted">No one yet. <Link href="/people/new">Add the first person</Link>.</p>}
      </section>
    </>
  );
}
