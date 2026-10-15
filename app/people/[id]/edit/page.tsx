import { notFound, redirect } from "next/navigation";
import { EditPerson } from "@/components/EditPerson";
import { ParentsCard } from "@/components/ParentsCard";
import { getSession, isAdmin } from "@/lib/auth";
import { relationsFor } from "@/lib/family";
import { listPeople } from "@/lib/data";
import { personDetails } from "@/lib/people";
import { findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Edit profile (the person themselves or the admin). Their place in the family tree is edited by Mary, from Settings, Admin, Family tree. */
export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await getSession();
  const [all, det, photos] = await Promise.all([
    listPeople(),
    personDetails(id, s),
    findPhotos({ people: [id] }, { order: "oldest", limit: 1000 }),
  ]);
  const person = all.find((p) => p.id === id);
  if (!person || !det) notFound();
  // Edit profile is for the person themselves or the admin. Everyone else can still add an address or
  // anniversary from the profile page.
  if (!det.canEdit) redirect(`/people/${id}`);
  // Parents are Mary's to set (the tree is admin only). A second parent is optional.
  const parents = isAdmin(s) ? (await relationsFor(id, s)).parents.map((r) => ({ id: r.person.id, name: r.person.name })) : null;
  return (
    <EditPerson det={det} avatarUrl={person.avatar_url} photos={photos.map((p) => ({ id: p.id, url: p.url }))}>
      {parents && <ParentsCard personId={id} name={det.name} parents={parents} />}
    </EditPerson>
  );
}
