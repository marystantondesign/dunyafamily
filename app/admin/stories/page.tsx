import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MyStories, NotionImport } from "@/components/MyStories";
import { getSession, isAdmin } from "@/lib/auth";
import { myStories } from "@/lib/storyAdmin";
import { bookRequests } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** My stories (Mary only): drafts, published and private stories, Add a story, the Notion import, and who wants the book. */
export default async function MyStoriesPage() {
  if (!isAdmin(await getSession())) notFound();
  const [rows, wants] = await Promise.all([myStories(), bookRequests()]);
  return (
    <div className="ms-page">
      <div className="ms-head">
        <h1>My stories</h1>
        <Link href="/admin/stories/new" className="ms-add"><Icon name="plus" size={16} stroke={2.6} />Add a story</Link>
      </div>
      <p className="ms-only">Only you can see this page.</p>
      <MyStories rows={rows} />
      <Link href="/admin/stories/book" className="ms-booklink">
        <Icon name="book" size={20} /><span>Printed book interest · {wants.length}</span><Icon name="chevronRight" size={18} />
      </Link>
      <NotionImport />
    </div>
  );
}
