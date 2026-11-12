import { cookies } from "next/headers";
import { StoriesIndex } from "@/components/StoriesIndex";
import { getSession } from "@/lib/auth";
import { listOccasions } from "@/lib/data";
import { featuredStory, publishedStories, storyPeople, wantsBook } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** In Her Words: Dunya's stories, by theme, and by the people, occasions, and decades they mention. */
export default async function StoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [s, sp, stories, occasions] = await Promise.all([getSession(), searchParams, publishedStories(), listOccasions()]);
  const [people, featured, want] = await Promise.all([storyPeople(stories), featuredStory(stories, Number((await cookies()).get("df_feat")?.value) || null), wantsBook(s?.pid)]);
  const usedOcc = new Set(stories.flatMap((x) => x.occasions));
  const decades = [...new Set(stories.flatMap((x) => x.decades))].sort((a, b) => a - b);
  return (
    <StoriesIndex
      stories={stories}
      featuredId={featured?.id ?? null}
      people={people}
      occasions={occasions.filter((o) => usedOcc.has(o.id)).map(({ id, name }) => ({ id, name }))}
      decades={decades}
      initial={{ theme: sp.theme ?? null, people: sp.people ?? "", occasions: sp.occasions ?? "", decades: sp.decades ?? "" }}
      want={want}
      canWant={!!s?.pid}
    />
  );
}
