import Link from "next/link";
import { AddressBookList } from "@/components/Contact";
import { Icon } from "@/components/Icon";
import { getSession, isAdmin } from "@/lib/auth";
import { addressBook } from "@/lib/people";

export const dynamic = "force-dynamic";

/** The family's mailing addresses, phones and emails. The admin sees everyone (shared or not) and edits any row. */
export default async function AddressBook() {
  const s = await getSession();
  const admin = isAdmin(s);
  const rows = await addressBook(s);
  const n = `${rows.length} ${rows.length === 1 ? "person" : "people"}`;
  return (
    <div className="ab-page">
      <Link href="/people" className="back-link"><Icon name="chevronLeft" size={16} /> Back to the family</Link>
      {rows.length ? (
        <AddressBookList admin={admin} title="Address book" sub={admin ? `${n} · Only you can see the ones that aren’t shared.` : n}
          rows={rows.map((r) => ({ id: r.id, name: r.name, avatarUrl: r.avatarUrl, contact: r.contact, shared: r.shared }))} />
      ) : (
        <>
          <div className="ab-intro"><h1>Address book</h1></div>
          <p className="muted">Nothing shared yet.</p>
        </>
      )}
    </div>
  );
}
