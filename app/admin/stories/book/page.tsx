import Link from "next/link";
import { notFound } from "next/navigation";
import { BookInterest } from "@/components/BookInterest";
import { Icon } from "@/components/Icon";
import { getSession, isAdmin } from "@/lib/auth";
import { bookRequests } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** Printed book interest (Mary only): everyone who tapped "I'd want a copy", newest first. */
export default async function BookInterestPage() {
  if (!isAdmin(await getSession())) notFound();
  const list = await bookRequests();
  return (
    <div className="bi-page">
      <Link href="/admin/stories" className="sf-back"><Icon name="chevronLeft" size={18} />My stories</Link>
      <h1>Printed book interest</h1>
      <p className="ms-only">Only you can see this page.</p>
      <BookInterest list={list} />
    </div>
  );
}
