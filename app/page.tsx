import Link from "next/link";
import { Gallery } from "@/components/Gallery";
import { Icon } from "@/components/Icon";
import { featuredAlbums, heroPortrait } from "@/lib/featured";
import { countPhotos, findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

function Sprig() {
  return (
    <svg aria-hidden="true" className="sprig" width="110" height="154" viewBox="0 0 100 140" fill="none" stroke="#8A6A4A" strokeWidth="1.1" strokeLinecap="round">
      <path d="M70 135C60 100 48 70 30 30" /><path d="M58 100C50 85 40 78 22 74" /><path d="M50 80C56 64 66 54 82 48" />
      <path d="M42 62C34 52 24 48 12 48" /><path d="M38 52C44 40 52 32 64 26" />
      <g fill="#E9D7B0" stroke="#B89462">
        <circle cx="30" cy="28" r="4" /><circle cx="24" cy="22" r="3.2" /><circle cx="34" cy="20" r="3" /><circle cx="21" cy="73" r="3.6" />
        <circle cx="15" cy="68" r="3" /><circle cx="83" cy="47" r="3.6" /><circle cx="88" cy="41" r="3" /><circle cx="11" cy="47" r="3.4" />
        <circle cx="65" cy="25" r="3.4" /><circle cx="70" cy="19" r="2.8" />
      </g>
    </svg>
  );
}

export default async function Home() {
  const [hero, albums, recent, untagged] = await Promise.all([
    heroPortrait(),
    featuredAlbums(),
    findPhotos({}, { order: "recent", limit: 12 }),
    countPhotos({ untagged: true }),
  ]);

  return (
    <>
      <section className="home-hero">
        <div className="polaroid-wrap">
          <Sprig />
          <figure className="polaroid">
            {hero.photo ? (
              <Link href={`/photos/${hero.photo.id}`} aria-label="Open this photo of Mamaw">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.photo.url} alt="Mamaw" />
              </Link>
            ) : <div className="polaroid-blank" />}
            <figcaption>Mamaw <Icon name="heart" size={20} stroke={1.5} /></figcaption>
          </figure>
        </div>
        <div className="home-hero-text">
          <h1>Our family,<br />through the years</h1>
          <p className="lede">A place for the memories we share.</p>
          <form action="/browse" role="search" className="search">
            <label htmlFor="hs" className="sr-only">Search photos, people, or occasions</label>
            <div className="search-field">
              <Icon name="search" />
              <input id="hs" name="q" placeholder="Search photos, people, or occasions..." />
            </div>
            <button className="btn btn-primary search-go">Search</button>
          </form>
          <Link href="/browse" className="text-link">Browse all photos <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      {albums.length > 0 ? (
        <section className="featured">
          <div className="section-head">
            <h2 className="section-title">Featured albums</h2>
            <Link href="/browse" className="text-link small">See all photos <span aria-hidden="true">→</span></Link>
          </div>
          <div className="album-grid">
            {albums.map((a) => (
              <Link key={a.title} href={a.href} className="album-card">
                <span>
                  <span className="album-title">{a.title}</span>
                  <span className="album-text">{a.text}</span>
                </span>
                <span className="album-photos">
                  {a.photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={p.id} src={p.url} alt="" loading="lazy" />
                  ))}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="featured">
          <h2 className="section-title">Start the collection</h2>
          <p className="lede">Add the first photos and tag who&apos;s in them.</p>
          <Link href="/upload" className="btn btn-primary">Add photos</Link>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="section-head">
            <h2 className="section-title">Recently added</h2>
            {untagged > 0 && (
              <Link href="/tag?untagged=1" className="needs-tags">
                {untagged} {untagged === 1 ? "photo needs" : "photos need"} tags. Know who&apos;s in them?
              </Link>
            )}
          </div>
          <Gallery photos={recent} base={150} query="order=recent" />
        </section>
      )}
    </>
  );
}
