import { notFound } from "next/navigation";
import { EditPerson } from "@/components/EditPerson";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { personDetails } from "@/lib/people";
import { findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await getSession();
  const [person, det, photos] = await Promise.all([
    listPeople().then((all) => all.find((p) => p.id === id)),
    personDetails(id, s),
    findPhotos({ people: [id] }, { order: "oldest", limit: 1000 }),
  ]);
  if (!person || !det) notFound();
  return <EditPerson det={det} avatarUrl={person.avatar_url} photos={photos.map((p) => ({ id: p.id, url: p.url }))} />;
}
