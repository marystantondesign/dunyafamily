import { notFound } from "next/navigation";
import { EditPerson } from "@/components/EditPerson";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { personDetails } from "@/lib/people";
import { findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

/** Edit a person. Their place in the family tree is edited by Mary, from Settings, Admin, Family tree. */
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
  return <EditPerson det={det} avatarUrl={person.avatar_url} photos={photos.map((p) => ({ id: p.id, url: p.url }))} />;
}
