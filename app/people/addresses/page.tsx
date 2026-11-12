import Link from "next/link";
import { AddressBookList } from "@/components/Contact";
import { Icon } from "@/components/Icon";
import { getSession, isAdmin } from "@/lib/auth";
import { addressBook, updatedLabel } from "@/lib/people";

export const dynamic = "force-dynamic";

/** Everyone's shared mailing addresses, emails, and phone numbers. The admin also sees and edits what isn't shared. */
export default async function AddressBook() {
  const s = await getSession();
  const admin = isAdmin(s);
  const rows = await addressBook(s);
  const intro = (
    <div className="ab-intro">
      <h1>Address book</h1>
      <p>Mailing addresses, emails and phone numbers people have chosen to share with the family.{admin && " As admin, you also see the ones that aren’t shared."}</p>
    </div>
  );
  return (
    <div className="ab-page">
      <Link href="/people" className="back-link"><Icon name="chevronLeft" size={16} /> Back to the family</Link>
      {rows.length ? (
        <AddressBookList admin={admin} intro={intro}
          rows={rows.map((r) => ({ id: r.id, name: r.name, contact: r.contact, updated: updatedLabel(r.updated_at), shared: r.shared }))} />
      ) : (
        <>{intro}<p className="muted">Nothing shared yet.</p></>
      )}
    </div>
  );
}
