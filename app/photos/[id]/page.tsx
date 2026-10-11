import { notFound } from "next/navigation";
import { PhotoEditor } from "@/components/PhotoEditor";
import { PhotoNav } from "@/components/PhotoNav";
import { PhotoView } from "@/components/PhotoView";
import { albumOptions, albumsFor, canTakeOut } from "@/lib/albums";
import { canRemove, getSession, isAdmin } from "@/lib/auth";
import { listOccasions, listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { filterQuery, filtersFrom, type SP } from "@/lib/filters";
import { neighbors, whenLabel, type PhotoRow } from "@/lib/photos";
import { signGet } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function PhotoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [photo] = await q<PhotoRow>(`select * from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) notFound();
  const s = await getSession();

  const [url, thumb, tagged, occasionTags, people, occasions, owners, albums, inAlbums] = await Promise.all([
    signGet(photo.original_key),
    signGet(photo.thumb_key),
    q<{ id: number; name: string; added_by_device: string | null }>(
      `select pe.id, pe.name, t.added_by_device from photo_people t join people pe on pe.id = t.person_id and pe.deleted_at is null where t.photo_id = $1 order by pe.name`, [id]),
    q<{ id: number; name: string; added_by_device: string | null }>(
      `select o.id, o.name, t.added_by_device from photo_occasions t join occasions o on o.id = t.occasion_id where t.photo_id = $1 order by o.name`, [id]),
    listPeople(),
    listOccasions(),
    q<{ id: number; avatar_photo_id: number | null; created_by_device: string | null }>(`select id, avatar_photo_id, created_by_device from people where deleted_at is null`),
    albumOptions(),
    albumsFor(id),
  ]);

  // Previous and next follow the view this photo was opened from (its browse filters ride along in the URL).
  const qs = filterQuery(sp);
  const order = sp.order === "oldest" ? "oldest" : sp.order === "recent" ? "recent" : "newest";
  const filters = filtersFrom(sp, occasions);
  const near = await neighbors(filters, order, id);
  const link = (pid: number | null | undefined) => (pid ? `/photos/${pid}${qs ? `?${qs}` : ""}` : undefined);
  const onlyPerson = filters.people?.length === 1 ? people.find((p) => p.id === filters.people![0]) : undefined;
  const onlyAlbum = filters.albums?.length === 1 && !filters.people?.length && !filters.occasions?.length && !filters.decades?.length ? filters.albums[0] : undefined;
  const backHref = onlyAlbum ? `/albums/${onlyAlbum}` : onlyPerson && !filters.occasions?.length && !filters.decades?.length && !filters.albums?.length ? `/people/${onlyPerson.id}` : `/browse${qs ? `?${qs}` : ""}`;
  const tagHref = `/tag?${qs ? `${qs}&` : ""}start=${id}`;

  const owner = canRemove(s, photo.uploaded_by_device);
  const removable = (dev: string | null) => owner || canRemove(s, dev);
  const personInfo = new Map(owners.map((o) => [o.id, o]));
  const canSetAvatar = (pid: number) => { const o = personInfo.get(pid); return !o?.avatar_photo_id || canRemove(s, o.created_by_device); };
  const when = whenLabel(photo);
  const title = [occasionTags[0]?.name, when].filter(Boolean).join(", ") || "Date unknown";
  const added = new Date(photo.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const avatarUrl = new Map(people.map((p) => [p.id, p.avatar_url]));
  const pos = near ? `Photo ${near.pos} of ${near.total}` : "Photo";

  return (
    <>
      <PhotoNav prev={link(near?.prev)} next={link(near?.next)} pos={near?.pos} total={near?.total} tagHref={tagHref} />
      <PhotoView
        photoId={id}
        imgUrl={url}
        thumbUrl={thumb}
        alt={tagged.length ? `${tagged.map((t) => t.name).join(", ")}${when ? `, ${when}` : ""}` : when ? `Family photo from ${when}` : "Family photo"}
        width={photo.width}
        height={photo.height}
        title={title}
        addedBy={`Added by ${photo.uploaded_by_name ?? "someone"}, ${added}`}
        caption={photo.caption}
        heading={onlyPerson ? `${onlyPerson.name} · ${pos}` : pos}
        closeHref={backHref}
        prevHref={link(near?.prev)}
        nextHref={link(near?.next)}
        people={tagged.map((t) => ({ id: t.id, name: t.name, avatarUrl: avatarUrl.get(t.id) ?? null }))}
        avatarFor={tagged.filter((t) => canSetAvatar(t.id) && personInfo.get(t.id)?.avatar_photo_id !== id).map((t) => ({ id: t.id, name: t.name }))}
        canDelete={owner}
        isAdmin={isAdmin(s)}
        albums={albums}
        inAlbums={inAlbums.map((a) => ({ id: a.id, title: a.title, canTakeOut: canTakeOut(s, a.added_by_device, a.created_by_device) }))}
      >
        <PhotoEditor
          photoId={id}
          people={tagged.map((t) => ({
            id: t.id,
            name: t.name,
            removable: removable(t.added_by_device),
            canSetAvatar: canSetAvatar(t.id),
            isAvatar: personInfo.get(t.id)?.avatar_photo_id === id,
          }))}
          occasions={occasionTags.map((t) => ({ id: t.id, name: t.name, removable: removable(t.added_by_device) }))}
          allPeople={people.map(({ id, name, aliases }) => ({ id, name, aliases }))}
          allOccasions={occasions}
          meta={{ year: photo.year, decade: photo.decade, caption: photo.caption }}
          canEditMeta={owner}
        />
      </PhotoView>
    </>
  );
}
