import Link from "next/link";
import { FamilyTree } from "@/components/FamilyTree";
import { earlierTree, familyTree, groupPhotos } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function People({ searchParams }: { searchParams: Promise<{ earlier?: string }> }) {
  const { tree, earlier, rootSiblings, groups, everyone } = await familyTree();
  const elders = await earlierTree();
  const openEarlier = (await searchParams).earlier === "1";
  const cards = await Promise.all(groups.filter((g) => g.people.length).map(async (g) => ({ ...g, photos: await groupPhotos(g.people.map((p) => p.id)) })));
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <>
      <h1 className="sr-only">Our family</h1>
      <FamilyTree tree={tree} earlier={earlier} siblings={rootSiblings} everyone={everyone.map(({ id, name }) => ({ id, name }))}
        earlierTree={elders} openEarlier={openEarlier} />

      {cards.length > 0 && (
        <section className="family-groups">
          <div className="section-head">
            <h2 className="section-title">More family &amp; loved ones</h2>
            <Link href="/#everyone" className="text-link small">Everyone <span aria-hidden="true">›</span></Link>
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

    </>
  );
}
