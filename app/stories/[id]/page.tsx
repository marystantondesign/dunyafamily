import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { BookSketch } from "@/components/Sketches";
import { StoryFace } from "@/components/StoriesIndex";
import { getSession } from "@/lib/auth";
import { storyPage } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** One of Dunya's stories: the title, the question, her answer, who's in it, and the next story. */
export default async function StoryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const [{ id }, sp, s] = await Promise.all([params, searchParams, getSession()]);
  const story = await storyPage(Number(id), s);
  if (!story) notFound();
  // Back to the index with the same theme and filters.
  const back = `/stories${sp.from && /^[\w=&%,.-]*$/.test(sp.from) ? `?${sp.from}` : ""}`;
  const from = sp.from ? `?from=${encodeURIComponent(sp.from)}` : "";
  return (
    <div className="sp">
      <Link href={back} className="back-link sp-back"><Icon name="chevronLeft" size={16} /> In Her Words</Link>
      <div className="sp-cols">
        <article className="sp-main">
          {story.status !== "published" && <p className="notice">Draft. Only you can see this until it&apos;s published.</p>}
          <p className="sc-theme">{story.themeLabel}</p>
          <h1 className="sp-title">{story.title || "Untitled"}</h1>
          <p className="sp-time">{story.minutes} min read</p>
          {story.heroUrl && (
            <figure className="sp-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={story.heroUrl} alt={story.heroCaption ?? ""} />
              {story.heroCaption && <figcaption>{story.heroCaption}</figcaption>}
            </figure>
          )}
          <div className="sp-question">
            <p className="sp-qlabel">The question</p>
            <p className="sp-qtext">{story.question}</p>
          </div>
          <div className="sp-answer">
            {story.blocks.map((b, i) => b.kind === "p" ? <p key={i}>{b.text}</p> : (
              <figure key={i} className="sp-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.url!} alt={b.caption} loading="lazy" />
                {b.caption && <figcaption>{b.caption}</figcaption>}
              </figure>
            ))}
          </div>
        </article>
        <aside className="sp-side">
          {story.tagged.length > 0 && (
            <section className="sp-card">
              <h2>In this story</h2>
              <div className="sp-chips">
                {story.tagged.map((p) => (
                  <Link key={p.id} href={`/stories?people=${p.slug}`} className="sp-chip">
                    <StoryFace p={p} size={32} /> {p.first}
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="sp-more">
            <h2>Keep reading</h2>
            {story.next && (
              <Link href={`/stories/${story.next.id}${from}`} className="sp-next">
                <span className={`sp-next-photo${story.next.photoUrl ? "" : " empty"}`} aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {story.next.photoUrl ? <img src={story.next.photoUrl} alt="" /> : <BookSketch height={36} />}
                </span>
                <span className="sp-next-text"><span className="sc-theme">Next story</span><span className="sp-next-title">{story.next.title}</span></span>
                <Icon name="chevronRight" size={20} className="sp-next-chev" />
              </Link>
            )}
            <Link href={back} className="sp-all">All stories</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
