import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { listPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function People() {
  const people = await listPeople();
  return (
    <>
      <div className="page-head with-actions">
        <div>
          <h1 className="display">Our family</h1>
          <p>Rooted in Dunya. Growing through generations.</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/people/addresses" className="btn">Address book</Link>
          <Link href="/people/new" className="btn btn-primary">+ Add someone</Link>
        </div>
      </div>
      <div className="people">
        {people.map((p) => (
          <Link key={p.id} href={`/people/${p.id}`} className="person">
            <Avatar name={p.name} url={p.avatar_url} />
            <span className="person-label">{p.name}</span>
            {p.in_memory && <span className="in-memory small">In memory</span>}
          </Link>
        ))}
      </div>
      {!people.length && <p className="muted">No one yet. <Link href="/people/new">Add the first person</Link>.</p>}
    </>
  );
}
