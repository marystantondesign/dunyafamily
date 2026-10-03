import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoEditor } from "@/components/PhotoEditor";
import { RemoveButton } from "@/components/RemoveButton";
import { canRemove, getSession, isAdmin } from "@/lib/auth";
import { listOccasions, listPeople, relativeDays } from "@/lib/data";
import { q } from "@/lib/db";
import { whenLabel, type PhotoRow } from "@/lib/photos";
import { signGet } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [photo] = await q<PhotoRow>(`select * from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) notFound();
  const s = await getSession();

  const [url, tagged, occasionTags, people, occasions, avatars] = await Promise.all([
    signGet(photo.original_key),
    q<{ id: number; name: string; added_by_device: string | null }>(
      `select pe.id, pe.name, t.added_by_device from photo_people t join people pe on pe.id = t.person_id where t.photo_id = $1 order by pe.name`, [id]),
    q<{ id: number; name: string; added_by_device: string | null }>(
      `select o.id, o.name, t.added_by_device from photo_occasions t join occasions o on o.id = t.occasion_id where t.photo_id = $1 order by o.name`, [id]),
    listPeople(),
    listOccasions(),
    q<{ id: number; avatar_photo_id: number | null }>(`select id, avatar_photo_id from people where deleted_at is null`),
  ]);

  const owner = canRemove(s, photo.uploaded_by_device);
  const removable = (dev: string | null) => owner || canRemove(s, dev);
  const when = whenLabel(photo);

  return (
    <div className="photo-layout">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="full" src={url} alt={when ? `Family photo from ${when}` : "Family photo"} width={photo.width ?? undefined} height={photo.height ?? undefined} />
      <div>
        <div className="meta-block">
          <h1 className="section-title" style={{ marginBottom: 4 }}>{when ?? "Date unknown"}</h1>
          {photo.caption && <p style={{ margin: "8px 0 0" }}>{photo.caption}</p>}
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            Added by {photo.uploaded_by_name ?? "someone"} {relativeDays(photo.created_at)}
          </p>
        </div>
        <PhotoEditor
          photoId={id}
          people={tagged.map((t) => ({
            id: t.id,
            name: t.name,
            removable: removable(t.added_by_device),
            canSetAvatar: isAdmin(s) || !avatars.find((a) => a.id === t.id)?.avatar_photo_id,
            isAvatar: avatars.find((a) => a.id === t.id)?.avatar_photo_id === id,
          }))}
          occasions={occasionTags.map((t) => ({ id: t.id, name: t.name, removable: removable(t.added_by_device) }))}
          allPeople={people.map(({ id, name, aliases }) => ({ id, name, aliases }))}
          allOccasions={occasions}
          meta={{ year: photo.year, decade: photo.decade, caption: photo.caption }}
          canEditMeta={owner}
        />
        <div className="meta-block" style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/browse" className="small">Back to browse</Link>
          {owner && <RemoveButton url={`/api/photos/${id}`} label="Remove photo" confirmText="Remove this photo from the site?" redirectTo="/browse" />}
        </div>
      </div>
    </div>
  );
}
