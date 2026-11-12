import Link from "next/link";
import { notFound } from "next/navigation";
import { StoriesAdminTools } from "@/components/StoryEditor";
import { getSession, isAdmin } from "@/lib/auth";
import { allStories, bookRequests, storyPin, themeLabel } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** Mary's In Her Words admin: bring stories over from Notion, edit and publish them, and see who wants the book. */
export default async function StoriesAdmin() {
  if (!isAdmin(await getSession())) notFound();
  const [stories, wants, pin] = await Promise.all([allStories(), bookRequests(), storyPin()]);
  return (
    <div className="admin-page">
      <div className="page-head with-actions">
        <div>
          <h1 className="display">In Her Words</h1>
          <p>Stories come over from Notion as drafts. Give each one a title and a theme, tag who it mentions, then publish.</p>
        </div>
        <StoriesAdminTools />
      </div>
      <ul className="story-admin-list">
        {stories.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/stories/${s.id}`}>
              <strong>{s.title || <span className="muted">No title yet</span>}</strong>
              <span className="small muted">{s.question}</span>
            </Link>
            <span className={`story-status ${s.status}`}>{s.status === "published" ? "Published" : "Draft"}</span>
            {s.theme && <span className="small muted">{themeLabel(s.theme)}</span>}
            {pin === s.id && <span className="small">Pinned as featured</span>}
          </li>
        ))}
        {!stories.length && <li className="muted">No stories yet. Bring them over from Notion.</li>}
      </ul>
      <section>
        <h2 className="section-title">Want a printed copy</h2>
        {wants.length ? <p>{wants.map((w) => w.name).join(", ")}</p> : <p className="muted">No one yet.</p>}
      </section>
    </div>
  );
}
