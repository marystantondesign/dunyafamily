import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SubmissionActions } from "@/components/SubmissionActions";
import { getSession, isAdmin } from "@/lib/auth";
import { submission } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/** One submitted story (Mary only), read-only: who sent it, when, who it's about, the story, and its photos. */
export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await getSession())) notFound();
  const s = await submission(Number((await params).id));
  if (!s) notFound();
  return (
    <article className="sd-page">
      <Link href="/admin/stories?tab=submitted" className="sf-back"><Icon name="chevronLeft" size={18} />Submitted stories</Link>
      <div className="sd-from">
        <span className="ms-from-face" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {s.fromAvatar ? <img src={s.fromAvatar} alt="" /> : s.from.charAt(0)}
        </span>
        <span>From <strong>{s.fromId ? <Link href={`/people/${s.fromId}`}>{s.from}</Link> : s.from}</strong> · {s.received}</span>
      </div>
      {s.about.length > 0 && <p className="sd-about">About {s.about.map((p, i) => <span key={p.id}>{i > 0 && ", "}<Link href={`/people/${p.id}`}>{p.name}</Link></span>)}</p>}
      <h1 className={s.title ? "" : "untitled"}>{s.title || "Untitled"}</h1>
      <div className="sd-body">{s.body.split(/\n\s*\n/).map((para, i) => <p key={i}>{para}</p>)}</div>
      {s.photos.length > 0 && (
        <div className="sd-photos">
          {s.photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={p.full} target="_blank" rel="noreferrer"><img src={p.thumb} alt={`Photo ${i + 1}`} /></a>
          ))}
        </div>
      )}
      <SubmissionActions id={s.id} draftId={s.draftStoryId} />
    </article>
  );
}
