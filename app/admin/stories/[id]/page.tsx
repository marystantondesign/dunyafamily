import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { displayName } from "@/lib/names";
import { StoryForm } from "@/components/StoryForm";
import { getSession, isAdmin } from "@/lib/auth";
import { listOccasions } from "@/lib/data";
import { storyForm, storyPeopleOptions } from "@/lib/storyAdmin";

export const dynamic = "force-dynamic";

/** Edit a story (Mary only). */
export default async function EditStory({ params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await getSession())) notFound();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [story, people, occasions, [credit]] = await Promise.all([storyForm(id), storyPeopleOptions(), listOccasions(),
    q<{ name: string | null }>(`select coalesce(pe.name, s.credit_name) as name from stories s left join people pe on pe.id = s.credit_person_id where s.id = $1`, [id]).catch(() => [])]);
  if (!story) notFound();
  return (
    <>
      {/* A story made from one a family member sent: their credit stays with it. */}
      {credit?.name && <p className="sd-credit">Sent by {displayName(credit.name)}</p>}
      <StoryForm initial={story} people={people} occasions={occasions.map(({ id, name }) => ({ id, name }))} />
    </>
  );
}
