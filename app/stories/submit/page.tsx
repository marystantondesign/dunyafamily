import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SubmitStory } from "@/components/SubmitStory";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { findDunya } from "@/lib/featured";

export const dynamic = "force-dynamic";

/** Submit a story: a family member sends Mary a story about someone in the family. It isn't posted on the site. */
export default async function SubmitStoryPage() {
  const s = await getSession();
  if (!s) redirect("/enter");
  if (!s.pid) {
    return (
      <div className="ss-page">
        <Link href="/stories" className="sf-back"><Icon name="chevronLeft" size={18} />In Her Words</Link>
        <h1>Submit a story</h1>
        <p className="ss-intro">Pick yourself first, so Mary knows who sent it.</p>
        <Link href="/enter/who" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Pick yourself</Link>
      </div>
    );
  }
  const [people, dunya] = await Promise.all([listPeople(), findDunya()]);
  const me = people.find((p) => p.id === s.pid);
  return (
    <SubmitStory
      me={{ name: me?.name ?? s.name, avatarUrl: me?.avatar_url ?? null, inMemory: false }}
      people={people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, avatarUrl: p.avatar_url, inMemory: p.in_memory }))}
      start={dunya ? [dunya.id] : []}
    />
  );
}
