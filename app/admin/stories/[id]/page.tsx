import { notFound } from "next/navigation";
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
  const [story, people, occasions] = await Promise.all([storyForm(id), storyPeopleOptions(), listOccasions()]);
  if (!story) notFound();
  return <StoryForm initial={story} people={people} occasions={occasions.map(({ id, name }) => ({ id, name }))} />;
}
