import { notFound } from "next/navigation";
import { FamilyAdmin } from "@/components/FamilyAdmin";
import { getSession, isAdmin } from "@/lib/auth";
import { findDunya } from "@/lib/featured";
import { editData } from "@/lib/familyAdmin";

export const dynamic = "force-dynamic";

/** Settings, Admin, Family tree: edit one person's connections at a time. Starts on Dunya. */
export default async function FamilyAdminPage({ searchParams }: { searchParams: Promise<{ person?: string }> }) {
  if (!isAdmin(await getSession())) notFound();
  const sp = await searchParams;
  const id = Number(sp.person) || (await findDunya())?.id;
  const data = id ? await editData(id) : null;
  if (!data) return <p className="muted">Add Dunya to the family first, then come back here to build the tree.</p>;
  const strip = (r: { person: { id: number; name: string; avatarUrl: string | null; inMemory: boolean; birthYear: number | null } ; role: string }) =>
    ({ role: r.role, person: { id: r.person.id, name: r.person.name, avatarUrl: r.person.avatarUrl, inMemory: r.person.inMemory, birthYear: r.person.birthYear } });
  return (
    <FamilyAdmin
      key={data.person.id}
      data={{
        person: { id: data.person.id, name: data.person.name, avatarUrl: data.person.avatarUrl, inMemory: data.person.inMemory, birthYear: data.person.birthYear, friend: data.person.friend },
        parents: data.parents.map(strip), siblings: data.siblings.map(strip), partners: data.partners.map(strip), children: data.children.map(strip),
      }}
      everyone={data.everyone}
    />
  );
}
