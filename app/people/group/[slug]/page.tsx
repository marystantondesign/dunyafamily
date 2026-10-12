import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Halo } from "@/components/Halo";
import { Icon } from "@/components/Icon";
import { familyTree } from "@/lib/family";

export const dynamic = "force-dynamic";

/** One of the "More family & loved ones" groups: who's in it, each linking to their page and photos. */
export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = (await familyTree()).groups.find((g) => g.slug === slug);
  if (!group) notFound();
  return (
    <>
      <Link href="/people" className="back-link"><Icon name="chevronLeft" size={18} /> Our family</Link>
      <div className="page-head">
        <h1 className="display">{group.title}</h1>
        <p>{group.text}.</p>
      </div>
      {group.people.length ? (
        <div className="people">
          {group.people.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`} className="person">
              <Halo on={p.inMemory} name={p.name}><Avatar name={p.name} url={p.avatarUrl} /></Halo>
              <span className="person-label">{p.name}</span>
            </Link>
          ))}
        </div>
      ) : <p className="muted">No one here yet.</p>}
      {slug === "unplaced" && group.people.length > 0 && (
        <p className="hint" style={{ marginTop: 24 }}>To place someone, open their page, choose Edit details, and add their parents, partner, or children under Family.</p>
      )}
    </>
  );
}
