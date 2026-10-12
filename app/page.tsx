import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { Avatar } from "@/components/Avatar";
import { Halo } from "@/components/Halo";
import { HeroPolaroid } from "@/components/HeroPolaroid";
import { birthdaysToday, everyone, featuredCollections, heroSlides, HOME_COPY, onThisDay } from "@/lib/home";
import { Gallery } from "@/components/Gallery";
import { whenLabel } from "@/lib/when";

export const dynamic = "force-dynamic";

const photos = (n: number) => `${n} ${n === 1 ? "photo" : "photos"}`;

export default async function Home() {
  const [hero, collections, people, bdays, past] = await Promise.all([heroSlides(), featuredCollections(), everyone(), birthdaysToday(), onThisDay()]);

  // Birthday takeover: on someone's birthday the hero is theirs, fading through photos of them across the years.
  const celebrating = bdays.filter((b) => !b.inMemory);
  const remembering = bdays.filter((b) => b.inMemory);
  const names = (list: string[]) => (list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`);
  const takeover = celebrating.length > 0;
  const slides = takeover
    ? celebrating.flatMap((b) => b.photos.map((p) => ({ id: p.id, url: p.url, caption: [celebrating.length > 1 ? b.name : "", whenLabel(p)].filter(Boolean).join(", ") || null })))
    : hero.slides;
  const title = takeover ? `Happy birthday, ${names(celebrating.map((b) => b.name))}` : HOME_COPY.title;
  const subtitle = takeover
    ? celebrating.length === 1 && celebrating[0].turns ? `${celebrating[0].name} turns ${celebrating[0].turns} today.` : "A day to celebrate."
    : HOME_COPY.subtitle;

  return (
    <>
      <section className={`home-hero${takeover ? " birthday" : ""}`}>
        <HeroPolaroid slides={slides.length ? slides : hero.slides} seconds={hero.seconds} />
        <div className="home-hero-text">
          {takeover && <span className="hero-eyebrow">Today</span>}
          <h1>{title}</h1>
          <p className="lede">{subtitle}</p>
          {takeover && (
            <p className="hero-links">
              {celebrating.map((b) => <Link key={b.id} href={`/people/${b.id}`} className="text-link small">See {b.name}&apos;s photos <span aria-hidden="true">→</span></Link>)}
            </p>
          )}
          {remembering.length > 0 && (
            <p className="hero-remember small">
              Today would have been {remembering.map((b, i) => <span key={b.id}>{i > 0 && (i === remembering.length - 1 ? " and " : ", ")}<Link href={`/people/${b.id}`}>{b.name}</Link>{remembering.length === 1 ? "'s" : ""}</span>)} {remembering.length === 1 ? "birthday" : "birthdays"}.
            </p>
          )}
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

      {past.length > 0 && (
        <section className="on-this-day">
          <div className="section-head">
            <h2 className="section-title">On this day</h2>
            <span className="small muted">Photos taken on today&apos;s date in years past</span>
          </div>
          <Gallery photos={past} base={150} showWhen />
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
                  <Halo on={p.inMemory} name={p.name}><Avatar name={p.name} url={p.avatarUrl} /></Halo>
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
