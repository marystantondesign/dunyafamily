import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { HeroPolaroid } from "@/components/HeroPolaroid";
import { birthdaysToday, everyoneInOrder, featuredCollections, heroSlides, HOME_COPY, onThisDay } from "@/lib/home";
import { Gallery } from "@/components/Gallery";
import { EveryoneList } from "@/components/EveryoneList";
import { BookSketch, RecipeBoxSketch } from "@/components/Sketches";
import { Icon } from "@/components/Icon";
import { recipeCount } from "@/lib/recipes";
import { whenLabel } from "@/lib/when";

export const dynamic = "force-dynamic";


export default async function Home() {
  const [hero, collections, people, bdays, past, recipes] = await Promise.all([heroSlides(), featuredCollections(), everyoneInOrder(), birthdaysToday(), onThisDay(), recipeCount()]);

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

      {/* Recipes and In Her Words. In Her Words is a card only for now: its stories pages aren't designed yet. */}
      <section className="home-keep" aria-label="Recipes and stories">
        <div className="hk-card">
          <Link href="/recipes" className="hk-art" tabIndex={-1} aria-hidden="true"><RecipeBoxSketch height={132} /></Link>
          <div className="hk-text">
            <h2><Link href="/recipes" className="hk-link">Recipes</Link></h2>
            <p>
              <span className="desktop-only">{recipes ? `${recipes} ${recipes === 1 ? "recipe" : "recipes"} in the box` : "Start the recipe box"}</span>
              <span className="phone-only">{recipes ? `${recipes} ${recipes === 1 ? "recipe" : "recipes"}` : "Start the box"}</span>
            </p>
            <div className="hk-actions">
              <Link href="/recipes" className="btn btn-primary">Open the box</Link>
              <Link href="/recipes/new" className="btn"><Icon name="plus" size={16} stroke={2} />Add a recipe</Link>
            </div>
          </div>
        </div>
        <div className="hk-card soon">
          <div className="hk-art"><BookSketch height={132} /></div>
          <div className="hk-text">
            <h2>In Her Words</h2>
            <p>Coming soon</p>
          </div>
        </div>
      </section>

      {past.length > 0 && (
        <section className="on-this-day">
          <div className="section-head">
            <h2 className="section-title">On this day</h2>
            <span className="small muted">Photos taken on today&apos;s date in years past</span>
          </div>
          <Gallery photos={past} base={150} showWhen />
        </section>
      )}

      {people.family.length + people.others.length > 0 && (
        <section className="everyone" id="everyone">
          <EveryoneList family={people.family} others={people.others} />
        </section>
      )}
    </>
  );
}
