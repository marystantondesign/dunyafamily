import Link from "next/link";
import { notFound } from "next/navigation";
import { Halo } from "@/components/Halo";
import { Icon } from "@/components/Icon";
import { MyPhotos } from "@/components/MyPhotos";
import { ProfileContactCard } from "@/components/Contact";
import { ProfilePhotoPicker } from "@/components/PeopleBits";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { daysUntil, monthDay, personDetails, soonLabel } from "@/lib/people";
import { findPhotos } from "@/lib/photos";
import { isInMemory } from "@/lib/inMemory";
import { whenLabel } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await getSession();
  const [person, det] = await Promise.all([listPeople().then((all) => all.find((p) => p.id === id)), personDetails(id, s)]);
  if (!person || !det) notFound();

  // Relationships live on the family tree, not on profiles.
  const photos = await findPhotos({ people: [id] }, { order: "oldest", limit: 1000 });
  const gone = isInMemory(det);
  const query = `people=${id}&order=oldest`;
  const seeAll = `/browse?people=${id}&order=oldest`;
  // Birthday year: only the person themselves and the admin see it.
  const bday = det.birthday && monthDay(det.birthday.month, det.birthday.day, det.canEdit ? det.birthday.year : null);
  const bdaySoon = det.birthday && !gone ? soonLabel(det.birthday.month, det.birthday.day) : null;
  // Every anniversary (and other yearly date) with its note, soonest first: "June 2, 1962 · Our wedding".
  const anniversaries = det.dates.filter((d) => d.kind !== "remembrance")
    .map((d) => ({ id: d.id, month: d.month, day: d.day, year: d.year, label: d.label,
      text: `${monthDay(d.month, d.day, d.year)}${d.label ? ` · ${d.label}` : ""}`, soon: daysUntil(d.month, d.day) }))
    .sort((a, b) => a.soon - b.soon);
  const pill = (t: string | null) => t && <span className="soon-pill">{t}</span>;
  const pickPhotos = photos.map((p) => ({ id: p.id, url: p.url }));
  // One contact card: nothing for someone in memory; otherwise what's shared (everything for them and the admin).
  const card = !gone && (det.canEdit || det.contact || anniversaries.length > 0)
    ? <ProfileContactCard personId={id} name={person.name} contact={det.contact} share={det.shareAddress} canEdit={det.canEdit}
        anniversaries={anniversaries.map(({ soon: _soon, ...a }) => a)} />
    : null;

  const portrait = (
    <div className="profile-photo">
      <Halo on={det.inMemory} square>
        <div className="portrait">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {person.avatar_url ? <img src={person.avatar_url} alt={det.inMemory ? `${person.name}, in memory` : person.name} /> : <span aria-hidden="true">{person.name.charAt(0)}</span>}
        </div>
      </Halo>
      {det.canChangePhoto && <ProfilePhotoPicker badge personId={id} name={person.name} photos={pickPhotos} current={det.avatarPhotoId} />}
    </div>
  );
  const photoGrid = (list: typeof photos) => list.map((p) => {
    const when = whenLabel(p);
    return (
      <Link key={p.id} href={`/photos/${p.id}?${query}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.url} alt={when ? `${person.name}, ${when}` : person.name} loading="lazy" />
      </Link>
    );
  });
  // Your own profile: Photos of you, with requests to remove photos of yourself.
  const mine = !!s?.pid && s.pid === id;
  const myList = photos.map((p) => { const when = whenLabel(p); return { id: p.id, url: p.url, href: `/photos/${p.id}?${query}`, alt: when ? `${person.name}, ${when}` : person.name }; });
  const noPhotos = <p className="muted" style={{ marginTop: 24 }}>No photos of {person.name} yet. <Link href="/tag?untagged=1">Tag some photos</Link>.</p>;

  return (
    <>
      {/* Phone: photo on the left; name, birthday, address, and anniversary on the right. */}
      <div className="profile-phone phone-only">
        <div className="profile-head">
          {portrait}
          <div className="profile-lines">
            <h1>{person.name}</h1>
            {det.inMemory && <p className="in-memory">In memory</p>}
            {bday && <p className="profile-line" aria-label={`Birthday, ${bday}${bdaySoon ? `, ${bdaySoon}` : ""}`}><Icon name="cake" size={18} /><span aria-hidden="true">{bday} {pill(bdaySoon)}</span></p>}
            {det.canEdit && <Link href={`/people/${id}/edit`} className="btn btn-primary profile-edit">Edit profile</Link>}
          </div>
        </div>
        {card}
        {mine && photos.length ? <MyPhotos variant="phone" photos={myList} seeAll={seeAll} /> : <>
          <div className="profile-photos-head">
            <h2>Photos</h2>
            {photos.length > 0 && <Link href={seeAll} className="small">See all {photos.length}</Link>}
          </div>
          {photos.length ? <div className="profile-grid">{photoGrid(photos.slice(0, 9))}</div> : noPhotos}
        </>}
      </div>

      {/* Desktop: photo, name, and the details box all start on one line. */}
      <div className="desktop-only">
        <div className="profile-top">
          {portrait}
          <div className="profile-name">
            <h1>{person.name}</h1>
            {det.inMemory && <p className="in-memory">In memory</p>}
            {bday && <p className="profile-line" aria-label={`Birthday, ${bday}${bdaySoon ? `, ${bdaySoon}` : ""}`}><Icon name="cake" size={18} /><span aria-hidden="true">{bday}</span><span aria-hidden="true">{pill(bdaySoon)}</span></p>}
            {det.canEdit && <Link href={`/people/${id}/edit`} className="btn btn-primary profile-edit">Edit profile</Link>}
          </div>
          {card}
        </div>

        {mine && photos.length ? <MyPhotos variant="desktop" photos={myList} seeAll={seeAll} />
          : photos.length ? <div className="photo-grid profile-desk-grid">{photoGrid(photos)}</div> : noPhotos}
      </div>
    </>
  );
}
