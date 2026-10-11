import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { CopyButton, ProfilePhotoPicker } from "@/components/PeopleBits";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { q } from "@/lib/db";
import { relationsFor } from "@/lib/family";
import { displayName } from "@/lib/names";
import { comingUp, monthDay, personDetails, shortMonthDay, updatedLabel } from "@/lib/people";
import { findPhotos } from "@/lib/photos";
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
  const familyLine = ([["Parents", rel.parents], ["Partner", rel.partners], ["Children", rel.children]] as const).filter(([, list]) => list.length);
  const anniversary = det.dates.find((d) => d.kind === "anniversary");
  const soon = comingUp(det);
  const query = `people=${id}&order=oldest`;

  return (
    <>
      <div className="person-top">
        <div className="person-id">
          <div className="portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {person.avatar_url ? <img src={person.avatar_url} alt={person.name} /> : <span aria-hidden="true">{person.name.charAt(0)}</span>}
          </div>
          <div className="person-name">
            <h1>{person.name}</h1>
            {det.inMemory && <p className="in-memory">In memory</p>}
            {det.birthday && (
              <p className="person-bday"><Icon name="cake" size={20} /> Birthday, {monthDay(det.birthday.month, det.birthday.day)}</p>
            )}
            <div className="person-actions">
              {det.canChangePhoto && (
                <ProfilePhotoPicker personId={id} name={person.name} photos={photos.map((p) => ({ id: p.id, url: p.url }))} current={det.avatarPhotoId} />
              )}
              <Link href={`/people/${id}/edit`} className="btn btn-primary">Edit details</Link>
            </div>
          </div>
        </div>

        <div className="details-card">
          <div className="detail">
            <p className="detail-label"><Icon name="mail" size={20} /> Mailing address</p>
            {det.address ? (
              <>
                <p className="address">{det.address}</p>
                <p className="small muted">{updatedLabel(det.addressUpdatedAt)}{!det.shareAddress && " · Not shared with the family"}</p>
                <div className="detail-copy"><CopyButton text={`${person.name}\n${det.address}`} label="Copy address" iconOnly /></div>
              </>
            ) : det.addressHidden ? (
              <p className="muted">Not shared</p>
            ) : (
              <Link href={`/people/${id}/edit#address`} className="small">Add an address</Link>
            )}
          </div>
          <div className="detail">
            <p className="detail-label"><Icon name="heart" size={20} /> Anniversary</p>
            {anniversary
              ? <p>{monthDay(anniversary.month, anniversary.day)}{anniversary.label && `, ${anniversary.label.replace(/^with /i, "with ")}`}</p>
              : <Link href={`/people/${id}/edit#dates`} className="small">Add a date</Link>}
          </div>
          <div className="detail">
            <p className="detail-label"><Icon name="calendar" size={20} /> Coming up</p>
            {soon ? <p>{soon.title}, {shortMonthDay(soon.month, soon.day)}</p> : <p className="muted">Nothing in the next two months</p>}
          </div>
        </div>
      </div>

      {familyLine.length > 0 && (
        <p className="often small family-line">
          {familyLine.map(([label, list], i) => (
            <span key={label}>{i > 0 && " · "}<span className="muted">{label}</span>{" "}
              {list.map((r, j) => <span key={r.relId}>{j > 0 && ", "}<Link href={`/people/${r.person.id}`}>{r.person.name}</Link></span>)}
            </span>
          ))}
        </p>
      )}

      {often.length > 0 && (
        <p className="often small">
          <span className="muted">Often photographed with</span>{" "}
          {often.map((o, i) => (
            <span key={o.id}>{i > 0 && " · "}<Link href={`/browse?people=${id},${o.id}`}>{displayName(o.name)}</Link> <span className="muted">{o.n}</span></span>
          ))}
        </p>
      )}

      {photos.length ? (
        <div className="photo-grid">
          {photos.map((p) => {
            const when = whenLabel(p);
            return (
              <Link key={p.id} href={`/photos/${p.id}?${query}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={when ? `${person.name}, ${when}` : person.name} loading="lazy" />
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 32 }}>No photos of {person.name} yet. <Link href="/tag?untagged=1">Tag some photos</Link>.</p>
      )}
    </>
  );
}
