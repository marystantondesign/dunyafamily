import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { listPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function People() {
  const people = await listPeople();
  return (
    <>
      <div className="page-head"><h1 className="display">Our family</h1><p>Rooted in Dunya. Growing through generations.</p></div>
      <div className="people">
        {people.map((p) => (
          <Link key={p.id} href={`/people/${p.id}`} className="person">
            <Avatar name={p.name} url={p.avatar_url} />
            {p.name}
          </Link>
        ))}
      </div>
    </>
  );
}
