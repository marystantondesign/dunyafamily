import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CopyButton } from "@/components/PeopleBits";
import { getSession, isAdmin } from "@/lib/auth";
import { addressBook, updatedLabel } from "@/lib/people";

export const dynamic = "force-dynamic";

/** Everyone's shared mailing addresses in one place, for invitations and holiday cards. */
export default async function AddressBook() {
  const s = await getSession();
  const rows = await addressBook(s);
  const visible = rows.filter((r) => r.address);
  const all = visible.map((r) => `${r.name}\n${r.address}`).join("\n\n");
  return (
    <>
      <Link href="/people" className="back-link"><Icon name="chevronLeft" size={16} /> Back to the family</Link>
      <div className="page-head with-actions" style={{ marginTop: 18 }}>
        <div>
          <h1 className="display">Address book</h1>
          <p>Mailing addresses people have chosen to share with the family.{isAdmin(s) && " As admin, you also see the ones that aren't shared."}</p>
        </div>
        {visible.length > 0 && (
          <div className="actions" style={{ marginTop: 0 }}>
            <CopyButton text={all} label="Copy all" />
            <a className="btn" href="/api/addresses" download>Download spreadsheet</a>
          </div>
        )}
      </div>
      {rows.length ? (
        <ul className="address-book">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/people/${r.id}`} className="ab-name">{r.name}</Link>
              {r.address ? <span className="address">{r.address}</span> : <span className="muted">Not shared</span>}
              <span className="small muted">{r.address && (r.shared ? updatedLabel(r.updated_at) : "Not shared with the family")}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No addresses yet. Add one from someone&apos;s page with Edit details.</p>
      )}
    </>
  );
}
