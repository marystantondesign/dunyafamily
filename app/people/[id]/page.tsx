import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ProfilePhotoPicker, QuickDetail } from "@/components/PeopleBits";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { relationsFor } from "@/lib/family";
import { displayName } from "@/lib/names";
import { monthDay, personDetails, soonLabel } from "@/lib/people";
import { findPhotos } from "@/lib/photos";
import { isInMemory } from "@/lib/inMemory";
import { whenLabel } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await getSession();
  const [person, det] = await Promise.all([listPeople().then((all) => all.find((p) => p.id === id)), personDetails(id, s)]);
  if (!person || !det) notFound();

  const [photos, often, rel] = await Promise.all([
    findPhotos({ people: [id] }, { order: "oldest", limit: 1000 }),
    q<{ id: number; name: string; n: number }>(
      `select pe.id, pe.name, count(*)::int as n
         from photo_people a
         join photo_people b on b.photo_id = a.photo_id and b.person_id <> a.person_id
         join people pe on pe.id = b.person_id and pe.deleted_at is null
         join photos ph on ph.id = a.photo_id and ph.deleted_at is null
        where a.person_id = $1 group by pe.id, pe.name order by n desc limit 6`,
      [id],
    ),
    relationsFor(id, s),
  ]);
  const anniversary = det.dates.find((d) => d.kind === "anniversary");
  const gone = isInMemory(det);
  const query = `people=${id}&order=oldest`;
  const seeAll = `/browse?people=${id}&order=oldest`;
  // Birthday year: only the person themselves and the admin see it.
  const bday = det.birthday && monthDay(det.birthday.month, det.birthday.day, det.canEdit ? det.birthday.year : null);
  const bdaySoon = det.birthday && !gone ? soonLabel(det.birthday.month, det.birthday.day) : null;
  const annSoon = anniversary && !gone ? soonLabel(anniversary.month, anniversary.day) : null;
  const annDate = anniversary && monthDay(anniversary.month, anniversary.day, anniversary.year);
  const annText = anniversary && `${annDate}${anniversary.label ? `, ${anniversary.label.replace(/^with /i, "with ")}` : ""}`;
  const pill = (t: string | null) => t && <span className="soon-pill">{t}</span>;
  const pickPhotos = photos.map((p) => ({ id: p.id, url: p.url }));
  const addressLines = det.address?.split("\n").map((l, i) => <span key={i}>{l}<br /></span>);
  const quickAddress = (link: string) => <QuickDetail personId={id} name={person.name} what="address" link={link} address={det.address ?? ""} />;
  const quickAnniversary = (link: string) => <QuickDetail personId={id} name={person.name} what="anniversary" link={link}
    anniversary={anniversary ? { id: anniversary.id, label: anniversary.label, month: anniversary.month, day: anniversary.day, year: anniversary.year } : null} />;

  const portrait = (
    <div className="profile-photo">
      <div className="portrait">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {person.avatar_url ? <img src={person.avatar_url} alt={person.name} /> : <span aria-hidden="true">{person.name.charAt(0)}</span>}
      </div>
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
            {!gone && !det.addressHidden && (
              <div className="profile-line"><Icon name="mail" size={18} />
                {det.address ? <span>{addressLines}</span> : <span>{quickAddress("Add an address")}</span>}
              </div>
            )}
            {anniversary ? (
              <p className="profile-line" aria-label={`Anniversary, ${annDate}${annSoon ? `, ${annSoon}` : ""}`}><Icon name="heart" size={18} /><span aria-hidden="true">{annDate} {pill(annSoon)}</span></p>
            ) : det.canEdit && (
              <div className="profile-line"><Icon name="heart" size={18} /><span>{quickAnniversary("Add an anniversary")}</span></div>
            )}
          </div>
        </div>
        {det.canEdit && <Link href={`/people/${id}/edit`} className="btn btn-primary profile-edit">Edit profile</Link>}
        <div className="profile-photos-head">
          <h2>Photos</h2>
          {photos.length > 0 && <Link href={seeAll} className="small">See all {photos.length}</Link>}
        </div>
        {photos.length ? <div className="profile-grid">{photoGrid(photos.slice(0, 9))}</div> : noPhotos}
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
          <section className="profile-details" aria-label="Details">
            {!gone && (
              <div className="detail">
                <p className="detail-label"><Icon name="mail" size={20} /> Mailing address</p>
                {det.addressHidden ? <p className="muted">Not shared</p>
                  : det.address ? <><p className="address">{addressLines}</p>{quickAddress("Edit")}</>
                  : quickAddress("Add an address")}
              </div>
            )}
            <div className="detail">
              <p className="detail-label"><Icon name="heart" size={20} /> Anniversary</p>
              {anniversary ? <><p aria-label={`Anniversary, ${annText}${annSoon ? `, ${annSoon}` : ""}`}><span aria-hidden="true">{annText} {pill(annSoon)}</span></p>{quickAnniversary("Edit")}</> : quickAnniversary("Add a date")}
            </div>
          </section>
        </div>

        {(rel.partners.length > 0 || rel.children.length > 0 || often.length > 0) && (
          <div className="profile-family">
            {([["Partner", rel.partners], ["Children", rel.children]] as const).filter(([, list]) => list.length).map(([label, list]) => (
              <p key={label}>{label}{" "}
                {list.map((r, j) => <span key={r.relId}>{j > 0 && ", "}<Link href={`/people/${r.person.id}`}>{r.person.name}</Link></span>)}
              </p>
            ))}
            {often.length > 0 && (
              <p>Often photographed with{" "}
                {often.map((o, i) => (
                  <span key={o.id}>{i > 0 && " · "}<Link href={`/browse?people=${id},${o.id}`}>{displayName(o.name)}</Link> {o.n}</span>
                ))}
              </p>
            )}
          </div>
        )}

        {photos.length ? <div className="photo-grid profile-desk-grid">{photoGrid(photos)}</div> : noPhotos}
      </div>
    </>
  );
}
