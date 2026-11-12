import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MyStories, NotionImport } from "@/components/MyStories";
import { getSession, isAdmin } from "@/lib/auth";
import { myStories } from "@/lib/storyAdmin";
import { bookRequests } from "@/lib/stories";
import { submissionRows } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/** My stories (Mary only): drafts, published and private stories, Add a story, the Notion import, and who wants the book. */
export default async function MyStoriesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!isAdmin(await getSession())) notFound();
  const [rows, wants, sent] = await Promise.all([myStories(), bookRequests(), submissionRows()]);
  const tab = (await searchParams).tab;
  return (
    <div className="ms-page">
      <div className="ms-head">
        <h1>My stories</h1>
        <Link href="/admin/stories/new" className="ms-add"><Icon name="plus" size={16} stroke={2.6} />Add a story</Link>
      </div>
      <p className="ms-only">Only you can see this page. <Link href="/admin/stories/book" className="ms-bookline">Printed book interest · {wants.length}</Link></p>
      <MyStories rows={rows} submitted={sent} start={tab === "submitted" || tab === "published" || tab === "private" ? tab : "draft"} />
      <NotionImport />
    </div>
  );
}
