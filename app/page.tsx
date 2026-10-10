import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Gallery } from "@/components/Gallery";
import { birthdays, lastUpload, listOccasions, listPeople, relativeDays, shortDate, upcomingGatherings } from "@/lib/data";
import { heroPhotos, pickHero } from "@/lib/hero";
import { countPhotos, findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";
const PEOPLE_ON_HOME = 11;

export default async function Home() {
  const hero = await pickHero();
  const [heroSet, bdays, gatherings, people, occasions, recent, last, untagged] = await Promise.all([
    heroPhotos(hero),
    birthdays(),
    upcomingGatherings(3),
    listPeople(),
    listOccasions(),
    findPhotos({}, { order: "recent", limit: 10 }),
    lastUpload(),
    countPhotos({ untagged: true }),
  ]);
  const soonBirthdays = bdays.filter((b) => b.inDays <= 60).slice(0, 4);

  return (
    <>
      <form action="/browse" className="search" role="search">
        <label htmlFor="q" className="sr-only">Search photos</label>
        <input id="q" name="q" placeholder="Search people, years, occasions" />
        <button className="btn">Search</button>
      </form>

      {heroSet.length > 0 ? (
        <>
          <div className="hero-head">
            <h1 className="display">{hero.title}</h1>
            <Link href={hero.href} className="small">See them all</Link>
          </div>
          <Gallery photos={heroSet} base={260} showWhen />
        </>
      ) : (
        <div style={{ marginTop: 40 }}>
          <h1 className="display">Start the collection</h1>
          <p className="muted">Add the first photos and tag who&apos;s in them.</p>
          <Link href="/upload" className="btn btn-primary">Add photos</Link>
        </div>
      )}

      <section className="upcoming" aria-label="Coming up">
        <div>
          <h3>Upcoming birthdays</h3>
          {soonBirthdays.length ? (
            <ul className="rows">
              {soonBirthdays.map((b) => (
                <li key={b.id}>
                  <Link href={`/people/${b.person_id}`}>{b.name}</Link>
                  <span className={b.inDays === 0 ? "today" : "date"}>{b.inDays === 0 ? "Today" : shortDate(b.next)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">None in the next two months.</p>
          )}
          <Link href="/calendar" className="small">All birthdays</Link>
        </div>
        <div>
          <h3>Coming up</h3>
          {gatherings.length ? (
            <ul className="rows">
              {gatherings.map((g) => (
                <li key={g.id}><span>{g.title}</span><span className="date">{shortDate(g.date)}</span></li>
              ))}
            </ul>
          ) : (
            <p className="small muted">Nothing planned yet.</p>
          )}
          <Link href="/calendar" className="small">Add a gathering or sync to your calendar</Link>
        </div>
      </section>

      {people.length > 0 && (
        <section>
          <h2 className="section-title">Family</h2>
          <div className="people">
            {people.slice(0, PEOPLE_ON_HOME).map((p) => (
              <Link key={p.id} href={`/people/${p.id}`} className="person">
                <Avatar name={p.name} url={p.avatar_url} />
                {p.name}
              </Link>
            ))}
            {people.length > PEOPLE_ON_HOME && (
              <Link href="/people" className="person">
                <div className="avatar" aria-hidden="true">+{people.length - PEOPLE_ON_HOME}</div>
                See everyone
              </Link>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Browse</h2>
        <div className="pills">
          {occasions.filter((o) => o.kind !== "season").map((o) => (
            <Link key={o.id} href={`/browse?occasions=${o.id}`} className="pill">{o.name}</Link>
          ))}
          <Link href="/browse" className="pill">By decade</Link>
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="hero-head" style={{ margin: "0 0 14px" }}>
            <h2 className="section-title" style={{ margin: 0 }}>Recently added</h2>
            {last && <span className="small muted">{last.name ?? "Someone"} added {last.n} {last.n === 1 ? "photo" : "photos"} {relativeDays(last.at)}</span>}
          </div>
          <Gallery photos={recent} base={140} />
          {untagged > 0 && (
            <Link href="/tag?untagged=1" className="needs-tags">
              {untagged} {untagged === 1 ? "photo needs" : "photos need"} tags. Know who&apos;s in them?
            </Link>
          )}
        </section>
      )}
    </>
  );
}
