import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { listPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function People() {
  const people = await listPeople();
  return (
    <>
      <h1 className="display" style={{ margin: "32px 0 24px" }}>Family</h1>
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
