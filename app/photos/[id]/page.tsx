import { notFound } from "next/navigation";
import { byName, displayName } from "@/lib/names";
import { PhotoScreen } from "@/components/PhotoScreen";
import { photoTalk } from "@/lib/comments";
import { albumOptions, albumsFor, canTakeOut } from "@/lib/albums";
import { homepageEntry, spotsUsed } from "@/lib/homepage";
import { canRemove, getSession, isAdmin } from "@/lib/auth";
import { listOccasions, listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { filterQuery, filtersFrom, resolveOrder, type SP } from "@/lib/filters";
import { shuffleSeed } from "@/lib/shuffle";
import { neighbors, whenLabel, type PhotoRow } from "@/lib/photos";
import { signGet } from "@/lib/r2";
import { isFavorite } from "@/lib/favorites";
import { whoAmI } from "@/lib/me";
import { canClearFlag } from "@/lib/taggingNeeded";

export const dynamic = "force-dynamic";

export default async function PhotoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const [photo] = await q<PhotoRow>(`select * from photos where id = $1 and deleted_at is null`, [id]);
  if (!photo) notFound();
  const s = await getSession();

  const [url, thumb, taggedRaw, occasionTags, people, occasions, owners, albums, inAlbums] = await Promise.all([
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
  const admin = isAdmin(s);
  const [hpEntry, hpUsed] = admin ? await Promise.all([homepageEntry(id), spotsUsed()]) : [null, 0];
  const [talk, favorite] = await Promise.all([photoTalk(id, s), isFavorite(s?.pid, id)]);
  const tagged = taggedRaw.map((t) => ({ ...t, name: displayName(t.name) }));

  // Previous and next follow the view this photo was opened from (its browse filters ride along in the URL).
  const qs = filterQuery(sp);
  const filters = filtersFrom(sp, occasions, s?.pid);
  const order = resolveOrder(sp, filters);
  const near = await neighbors(filters, order, id, await shuffleSeed());
  const link = (pid: number | null | undefined) => (pid ? `/photos/${pid}${qs ? `?${qs}` : ""}` : undefined);
  const onlyPerson = filters.people?.length === 1 ? people.find((p) => p.id === filters.people![0]) : undefined;
  const onlyAlbum = filters.albums?.length === 1 && !filters.people?.length && !filters.occasions?.length && !filters.decades?.length ? filters.albums[0] : undefined;
  const backHref = onlyAlbum ? `/albums/${onlyAlbum}` : onlyPerson && !filters.occasions?.length && !filters.decades?.length && !filters.albums?.length ? `/people/${onlyPerson.id}` : `/browse${qs ? `?${qs}` : ""}`;
  const tagHref = `/tag?${qs ? `${qs}&` : ""}start=${id}`;
  const slideshowHref = `/slideshow?${qs ? `${qs}&` : ""}start=${id}`;
  const backLabel = onlyAlbum ? albums.find((a) => a.id === onlyAlbum)?.title ?? "Album" : backHref.startsWith("/people/") && onlyPerson ? onlyPerson.name : "Browse";

  const owner = canRemove(s, photo.uploaded_by_device);
  const removable = (dev: string | null) => owner || canRemove(s, dev);
  const personInfo = new Map(owners.map((o) => [o.id, o]));
  const canSetAvatar = (pid: number) => { const o = personInfo.get(pid); return !o?.avatar_photo_id || canRemove(s, o.created_by_device); };
  const when = whenLabel(photo);
  // A photo name wins. Otherwise the occasion and year, like "NYC, 2026".
  const fallback = [occasionTags[0]?.name, when].filter(Boolean).join(", ");
  // A photo with no name is "Untitled". Its occasion and year still show, beside "Added by".
  const title = (photo as PhotoRow & { title: string | null }).title || "Untitled";
  const flag = photo as PhotoRow & { tagging_needed?: boolean; tagging_needed_by: number | null; tagging_needed_by_device: string | null };
  const added = new Date(photo.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <PhotoScreen
      photoId={id}
      imgUrl={url}
      thumbUrl={thumb}
      alt={tagged.length ? `${tagged.map((t) => t.name).join(", ")}${when ? `, ${when}` : ""}` : when ? `Family photo from ${when}` : "Family photo"}
      title={title}
      people={tagged.map(({ id, name }) => ({ id, name }))}
      addedBy={`Added by ${byName(photo.uploaded_by_name)}, ${added}`}
      about={fallback}
      pos={near?.pos ?? null}
      total={near?.total ?? null}
      prevHref={link(near?.prev)}
      nextHref={link(near?.next)}
      backHref={backHref}
      backLabel={backLabel}
      slideshowHref={slideshowHref}
      tagHref={tagHref}
      canDelete={owner}
      comments={talk.comments}
      reactions={talk.reactions}
      me={s ? await whoAmI(s).then((m) => ({ name: m.name, avatarUrl: m.avatarUrl })) : { name: "You", avatarUrl: null }}
      favorite={favorite}
      avatarFor={tagged.filter((t) => canSetAvatar(t.id) && personInfo.get(t.id)?.avatar_photo_id !== id).map((t) => ({ id: t.id, name: t.name }))}
      details={{
        photoId: id,
        title: (photo as PhotoRow & { title: string | null }).title,
        fallback,
        addedBy: `Added by ${byName(photo.uploaded_by_name)}, ${added}`,
        people: tagged.map((t) => ({ id: t.id, name: t.name, removable: removable(t.added_by_device) })),
        occasions: occasionTags.map((t) => ({ id: t.id, name: t.name, removable: removable(t.added_by_device) })),
        albums: inAlbums.map((a) => ({ id: a.id, name: a.title, removable: canTakeOut(s, a.added_by_device, a.created_by_device) })),
        year: photo.year,
        decade: photo.decade,
        canEditMeta: owner,
        allPeople: people.map(({ id, name, aliases }) => ({ id, name, aliases })),
        allOccasions: occasions.map(({ id, name }) => ({ id, name })),
        allAlbums: albums.map((a) => ({ id: a.id, name: a.title })),
        homepage: admin ? { entry: hpEntry, used: hpUsed } : null,
        taggingNeeded: { on: !!flag.tagging_needed, canClear: canClearFlag(s, { by: flag.tagging_needed_by, byDevice: flag.tagging_needed_by_device }) },
      }}
    />
  );
}
