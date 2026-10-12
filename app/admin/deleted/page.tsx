import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { RestoreButton } from "@/components/RestoreButton";
import { getSession, isAdmin } from "@/lib/auth";
import { listDeleted, type DeletedType } from "@/lib/deleted";

export const dynamic = "force-dynamic";

const ICON: Record<DeletedType, IconName> = {
  photo: "photo", person: "person", album: "album", birthday: "cake", gathering: "family", date: "calendar", relationship: "family", comment: "mail", prayer: "pray", recipe: "pencil", note: "comment",
};

const when = (d: string) => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
};

/** Recently deleted (admin): everything removed in the last 30 days, with Restore. */
export default async function DeletedPage() {
  if (!isAdmin(await getSession())) notFound();
  const items = await listDeleted();
  return (
    <div className="admin-page">
      <div className="page-head">
        <h1 className="display">Recently deleted</h1>
        <p>Photos, people, albums, dates, and comments removed in the last 30 days. Restore puts them back just as they were.</p>
      </div>
      {items.length ? (
        <ul className="deleted-list">
          {items.map((it) => (
            <li key={`${it.type}-${it.id}`}>
              <span className="deleted-thumb" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.thumbUrl ? <img src={it.thumbUrl} alt="" /> : <Icon name={ICON[it.type]} size={22} />}
              </span>
              <span className="deleted-text">
                <strong>{it.title}</strong>
                <span>{it.sub}</span>
                <span className="muted">Removed {when(it.deletedAt)}{it.deletedBy ? ` by ${it.deletedBy}` : ""}</span>
              </span>
              <RestoreButton type={it.type} id={it.id} />
            </li>
          ))}
        </ul>
      ) : <p className="muted">Nothing has been removed in the last 30 days.</p>}
    </div>
  );
}
