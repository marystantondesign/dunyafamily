import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { Avatar } from "@/components/Avatar";
import { Halo } from "@/components/Halo";
import { HeroPolaroid } from "@/components/HeroPolaroid";
import { everyone, featuredCollections, heroSlides, HOME_COPY } from "@/lib/home";

export const dynamic = "force-dynamic";

const photos = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

export default async function Home() {
  const [{ slides, seconds }, collections, people] = await Promise.all([heroSlides(), featuredCollections(), everyone()]);

  return (
    <>
      <section className="home-hero">
        <HeroPolaroid slides={slides} seconds={seconds} />
        <div className="home-hero-text">
          <h1>{HOME_COPY.title}</h1>
          <p className="lede">{HOME_COPY.subtitle}</p>
        </div>
      </section>

      {collections.length > 0 ? (
        <section className="featured">
          <div className="section-head">
            <h2 className="section-title">Featured albums</h2>
            <Link href="/albums" className="text-link small">
              <span className="desktop-only">See all albums <span aria-hidden="true">→</span></span>
              <span className="phone-only">See all</span>
            </Link>
          </div>
          <div className="album-grid">
            {collections.map((c) => <AlbumCard key={c.key} href={c.href} title={c.title} count={c.count} photos={c.photos} />)}
          </div>
        </section>
      ) : (
        <section className="featured">
          <h2 className="section-title">Start the collection</h2>
          <p className="lede">Add the first photos and tag who&apos;s in them.</p>
          <Link href="/upload" className="btn btn-primary">Add photos</Link>
        </section>
      )}

      {people.length > 0 && (
        <section className="everyone" id="everyone">
          <div className="section-head">
            <h2 className="section-title">Everyone</h2>
            <Link href="/people" className="text-link small">
              <span className="desktop-only">See the family tree <span aria-hidden="true">→</span></span>
              <span className="phone-only">Family tree</span>
            </Link>
          </div>
          <ul className="everyone-grid">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/people/${p.id}`} className="member">
                  <Halo on={p.inMemory}><Avatar name={p.name} url={p.avatarUrl} /></Halo>
                  <span className="member-name">{p.name}</span>
                  <span className="member-sub">{photos(p.photos)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
