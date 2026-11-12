import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { SubmittedList } from "@/components/SubmittedList";
import { getSession, isAdmin } from "@/lib/auth";
import { submissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/** Submitted stories (Mary only): what family members sent through Submit a story, newest first. */
export default async function SubmittedPage() {
  if (!isAdmin(await getSession())) notFound();
  const list = await submissions();
  return (
    <div className="bi-page">
      <Link href="/admin/stories" className="sf-back"><Icon name="chevronLeft" size={18} />My stories</Link>
      <h1>Submitted stories</h1>
      <p className="ms-only">Only you can see this page. Family members sent these through Submit a story.</p>
      <SubmittedList list={list} />
    </div>
  );
}
