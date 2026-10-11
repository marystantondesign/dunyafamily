import { notFound } from "next/navigation";
import { EditPerson } from "@/components/EditPerson";
import { FamilyEditor } from "@/components/FamilyEditor";
import { canRemove, getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { relationsFor } from "@/lib/family";
import { personDetails } from "@/lib/people";
import { findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await getSession();
  const [all, det, photos, rel, [owner]] = await Promise.all([
    listPeople(),
    personDetails(id, s),
    findPhotos({ people: [id] }, { order: "oldest", limit: 1000 }),
    relationsFor(id, s),
    q<{ created_by_device: string | null; family_friend_by_device: string | null }>(`select created_by_device, family_friend_by_device from people where id = $1`, [id]),
  ]);
  const person = all.find((p) => p.id === id);
  if (!person || !det) notFound();
  return (
    <EditPerson det={det} avatarUrl={person.avatar_url} photos={photos.map((p) => ({ id: p.id, url: p.url }))}>
      <FamilyEditor personId={id} name={det.name} rel={rel} people={all.map(({ id, name, aliases }) => ({ id, name, aliases }))}
        canUnfriend={canRemove(s, owner?.family_friend_by_device) || canRemove(s, owner?.created_by_device)} />
    </EditPerson>
  );
}
