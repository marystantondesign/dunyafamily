import { notFound } from "next/navigation";
import { StoryForm } from "@/components/StoryForm";
import { getSession, isAdmin } from "@/lib/auth";
import { listOccasions } from "@/lib/data";
import { storyForm, storyPeopleOptions } from "@/lib/storyAdmin";

export const dynamic = "force-dynamic";

/** Add a story (Mary only): a blank form. It's saved as a draft as soon as she starts typing. */
export default async function NewStory() {
  if (!isAdmin(await getSession())) notFound();
  const [story, people, occasions] = await Promise.all([storyForm(null), storyPeopleOptions(), listOccasions()]);
  return <StoryForm initial={story!} people={people} occasions={occasions.map(({ id, name }) => ({ id, name }))} />;
}
