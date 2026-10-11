"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon, type IconName } from "./Icon";

type Chip = { id: number; name: string; avatarUrl: string | null };

/**
 * The photo page. Desktop: the photo with its details and options beside it.
 * Phone: a dark full-screen viewer (screen 09). The ... button opens Photo options (screen 20),
 * and editing opens the same editor as a sheet. Deleting asks first (screen 21).
 */
export function PhotoView(props: {
  photoId: number; imgUrl: string; thumbUrl: string; alt: string; width: number | null; height: number | null;
  title: string; addedBy: string; caption: string | null;
  heading: string; closeHref: string; prevHref?: string; nextHref?: string;
  people: Chip[]; avatarFor: { id: number; name: string }[];
  canDelete: boolean; isAdmin: boolean; children: React.ReactNode;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"menu" | "edit" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  async function post(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
  }
  const run = async (fn: () => Promise<void>, done: string) => {
    try { await fn(); setNote(done); setSheet(null); router.refresh(); } catch (e) { setNote((e as Error).message); }
  };

  const options: { icon: IconName; label: string; sub?: string; onClick?: () => void; href?: string; danger?: boolean }[] = [
    { icon: "family", label: "Edit who's here", sub: "Add or remove names", onClick: () => setSheet("edit") },
    { icon: "calendar", label: "Edit year and occasion", onClick: () => setSheet("edit") },
    ...props.avatarFor.map((p) => ({
      icon: "person" as const, label: `Use as ${p.name}'s profile photo`,
      onClick: () => run(() => post(`/api/people/${p.id}`, "PATCH", { avatarPhotoId: props.photoId }), `Now ${p.name}'s profile photo.`),
    })),
    ...(props.isAdmin ? [{ icon: "home" as const, label: "Use as homepage photo", onClick: () => run(() => post("/api/settings/home-photo", "POST", { photoId: props.photoId }), "On the homepage now.") }] : []),
    { icon: "download", label: "Download original", href: `/api/photos/${props.photoId}/download` },
    ...(props.canDelete ? [{ icon: "trash" as const, label: "Delete photo", sub: "Kept in Recently deleted for 30 days", danger: true, onClick: () => { setSheet(null); setConfirming(true); } }] : []),
  ];

  const optionList = (
    <ul className="photo-options">
      {options.map((o) => {
        const inner = (<><Icon name={o.icon} size={24} /><span><span className="opt-label">{o.label}</span>{o.sub && <span className="opt-sub">{o.sub}</span>}</span></>);
        return (
          // Editing and profile photos live in the editor beside the photo on desktop, so the list only repeats them on phones.
          <li key={o.label} className={`${o.danger ? "danger" : ""}${o.label.startsWith("Edit") || o.label.endsWith("profile photo") ? " phone-only" : ""}`}>
            {o.href ? <a href={o.href}>{inner}</a> : <button type="button" onClick={o.onClick}>{inner}</button>}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={`photo-view${sheet === "edit" ? " editing" : ""}`}>
      <div className="viewer-bar">
        <button type="button" className="viewer-btn" aria-label="Photo options" aria-haspopup="dialog" onClick={() => setSheet("menu")}><Icon name="more" size={26} /></button>
        <span className="viewer-title">{props.heading}</span>
        <Link href={props.closeHref} className="viewer-btn" aria-label="Close"><Icon name="x" size={26} /></Link>
      </div>

      <div className="photo-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={props.imgUrl} alt={props.alt} width={props.width ?? undefined} height={props.height ?? undefined} />
        {props.prevHref && <Link href={props.prevHref} className="stage-arrow prev" aria-label="Previous photo"><Icon name="chevronLeft" size={26} /></Link>}
        {props.nextHref && <Link href={props.nextHref} className="stage-arrow next" aria-label="Next photo"><Icon name="chevronRight" size={26} /></Link>}
      </div>

      <div className="viewer-foot">
        {props.people.length > 0 && (
          <div className="viewer-chips">
            {props.people.map((p) => (
              <Link key={p.id} href={`/people/${p.id}`} className="viewer-chip">
                <span className="chip-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.avatarUrl ? <img src={p.avatarUrl} alt="" /> : p.name.charAt(0)}
                </span>
                {p.name}
              </Link>
            ))}
          </div>
        )}
        <p className="viewer-caption">{props.title}</p>
        {note && <p className="viewer-note" role="status">{note}</p>}
      </div>

      <div className="photo-side" role={sheet === "edit" ? "dialog" : undefined} aria-label={sheet === "edit" ? "Edit this photo" : undefined}>
        <div className="side-sheet-head">
          <span className="sheet-grip" aria-hidden="true" />
          <button type="button" className="text-btn" onClick={() => setSheet(null)}>Done</button>
        </div>
        <h1 className="photo-title">{props.title}</h1>
        <p className="small muted photo-added">{props.addedBy}</p>
        {props.caption && <p className="photo-caption">{props.caption}</p>}
        {props.children}
        <div className="desktop-options">
          {optionList}
          {note && <p className="small" role="status">{note}</p>}
        </div>
      </div>

      {sheet === "menu" && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet options-sheet" role="dialog" aria-modal="true" aria-label="Photo options" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grip" aria-hidden="true" />
            <p className="small muted" style={{ margin: "4px 4px 12px" }}>{props.addedBy}</p>
            {optionList}
          </div>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          image={props.thumbUrl}
          title="Delete this photo?"
          body="It comes off the site for everyone, including albums and people's pages. It stays in Recently deleted for 30 days in case you change your mind."
          keep="Keep it"
          confirm="Delete photo"
          onKeep={() => setConfirming(false)}
          onConfirm={async () => {
            setConfirming(false);
            try { await post(`/api/photos/${props.photoId}`, "DELETE"); window.location.assign(props.closeHref); } catch (e) { setNote((e as Error).message); }
          }}
        />
      )}
    </div>
  );
}
