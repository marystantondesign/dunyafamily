import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { StoryEditor } from "@/components/StoryEditor";
import { getSession, isAdmin } from "@/lib/auth";
import { listOccasions, listPeople } from "@/lib/data";
import { findDunya } from "@/lib/featured";
import { storyForEdit, storyPin } from "@/lib/stories";

export const dynamic = "force-dynamic";

export default async function EditStory({ params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(await getSession())) notFound();
  const id = Number((await params).id);
  const [story, people, occasions, dunya, pin] = await Promise.all([storyForEdit(id), listPeople(), listOccasions(), findDunya(), storyPin()]);
  if (!story) notFound();
  return (
    <div className="admin-page narrow">
      <Link href="/admin/stories" className="back-link"><Icon name="chevronLeft" size={18} /> In Her Words</Link>
      <StoryEditor
        story={{ id: story.id, title: story.title, question: story.question, body: story.body, heroPhotoId: story.hero_photo_id, heroCaption: story.hero_caption ?? "",
          theme: story.theme ?? "", people: story.people ?? [], occasions: story.occasions ?? [], decades: story.decades ?? [], status: story.status }}
        people={people.filter((p) => p.id !== dunya?.id).map(({ id, name, aliases }) => ({ id, name, aliases }))}
        occasions={occasions.map(({ id, name }) => ({ id, name }))}
        pinned={pin === story.id}
      />
    </div>
  );
}
