"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { FavoriteButton, FavoriteIcon, FavoriteToast, useFavorite } from "./FavoriteButton";
import { Icon } from "./Icon";
import { PhotoDetails, type DetailsData } from "./PhotoDetails";
import { Reactions, Thread, type Comment, type Reaction } from "./PhotoTalk";
import { QBadge } from "./TaggingNeeded";

/**
 * The photo page (mockups 32 and 33 on desktop, 8 and 9 on phones). The photo sits centered with round Previous
 * and Next buttons 20px from its edges (arrow keys and swiping work too), and its name, people, and reactions
 * under it. Comments open in a panel on the right on desktop (remembered on this device) and a sheet on phones.
 * Edit details opens a panel on the right on desktop and a sheet on phones, with the photo still in view.
 */
const COMMENTS_KEY = "df_comments_open";

export function PhotoScreen(props: {
  photoId: number; imgUrl: string; thumbUrl: string; alt: string;
  title: string; people: { id: number; name: string }[]; addedBy: string;
  pos: number | null; total: number | null; prevHref?: string; nextHref?: string;
  backHref: string; backLabel: string; slideshowHref: string; tagHref: string;
  canDelete: boolean; avatarFor: { id: number; name: string }[];
  details: DetailsData;
  comments: Comment[]; reactions: Reaction[]; me: string;
  /** Whether the person this visit picked has starred it. Only they ever see this. */
  favorite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Closed on a first visit; after that, open or closed the way it was last left on this device.
  const [talkOpen, setTalkOpen] = useState(false);
  // The phone drawer. With no comments yet it opens ready to type; otherwise it opens on the thread, keyboard down.
  const [sheet, setSheet] = useState<false | "read" | "write">(false);
  useEffect(() => { try { setTalkOpen(localStorage.getItem(COMMENTS_KEY) === "1"); } catch { /* private window */ } }, []);
  const showTalk = (on: boolean) => {
    setTalkOpen(on);
    if (on) setEditing(false);
    try { localStorage.setItem(COMMENTS_KEY, on ? "1" : "0"); } catch { /* private window */ }
  };
  const talking = !editing && talkOpen;
  const fav = useFavorite(props.photoId, props.favorite);
  // "Yes, I'll tag them" opens Edit details ready to add people; "Thanks for tagging!" follows "Yes, that's everyone".
  const [helping, setHelping] = useState(false);
  const [thanks, setThanks] = useState<{ text: string; star: boolean; key: number } | null>(null);
  useEffect(() => { if (!thanks) return; const t = setTimeout(() => setThanks(null), 2200); return () => clearTimeout(t); }, [thanks]);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (props.prevHref) router.prefetch(props.prevHref);
    if (props.nextHref) router.prefetch(props.nextHref);
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowLeft" && props.prevHref) router.push(props.prevHref);
      if (e.key === "ArrowRight" && props.nextHref) router.push(props.nextHref);
      if (e.key === "Escape") { setEditing(false); setSheet(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.prevHref, props.nextHref, router]);

  async function post(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't work. Try again.");
  }

  const count = props.pos && props.total ? `${props.pos} of ${props.total}` : "";
  const withLine = props.people.length > 0 && (
    <>With {props.people.map((p, i) => (
      <span key={p.id}>{i > 0 && (i === props.people.length - 1 ? " and " : ", ")}<Link href={`/people/${p.id}`}>{p.name}</Link></span>
    ))}. </>
  );

  const n = props.comments.filter((c) => !c.removed).length;
  const nComments = `${n} ${n === 1 ? "comment" : "comments"}`;
  // Tagging needed: under the caption, its own row so a narrow photo doesn't squeeze it.
  const askCard = props.details.taggingNeeded.on && (
    <div className="tn-card">
      <QBadge size={24} />
      <strong>Do you know who this is?</strong>
      <button type="button" className="btn btn-primary" onClick={() => { setHelping(true); setEditing(true); }}>Yes, I&apos;ll tag them</button>
    </div>
  );
  const heading = (
    <>
      <h1>{props.title}</h1>
      <div className="pv-meta-row">
        <p>{withLine}{props.addedBy}.</p>
        <Reactions photoId={props.photoId} reactions={props.reactions} />
      </div>
      {note && <p className="pv-note" role="status">{note}</p>}

    </>
  );

  return (
    <div className={`pv${editing ? " editing" : talking ? " talking" : ""}`}>
      <div className="pv-main">
        <div className="pv-bar">
          <Link href={props.backHref} className="pv-back">
            <Icon name="chevronLeft" size={22} className="phone-only" />
            <span className="desktop-only"><span aria-hidden="true">← </span>{props.backLabel}</span>
            <span className="sr-only phone-only">Back to {props.backLabel}</span>
          </Link>
          <span className="pv-count phone-only">{count}</span>
          <Link href={props.slideshowHref} className="btn pv-bar-btn pv-slideshow desktop-only"><Icon name="play" size={14} /> Slideshow</Link>
          <span className="pv-tools">
            {!talking && (
              <button type="button" className="btn pv-bar-btn desktop-only" onClick={() => showTalk(true)} aria-expanded={false}>
                <Icon name="comment" size={18} /> {n ? <>Comments <span className="pv-n">{n}</span></> : "Comment"}
              </button>
            )}
            <span className="phone-only"><FavoriteIcon on={fav.on} onToggle={fav.toggle} /></span>
            <Link href={props.slideshowHref} className="icon-btn phone-only" aria-label="Slideshow"><Icon name="play" size={20} /></Link>
            <button type="button" className="icon-btn phone-only" aria-label="Edit details" onClick={() => setEditing(true)}><Icon name="pencil" size={20} /></button>
          </span>
        </div>

        <div className="pv-stage"
          onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
          onTouchEnd={(e) => {
            const start = touch.current; touch.current = null;
            if (!start) return;
            const t = e.changedTouches[0], dx = t.clientX - start.x, dy = t.clientY - start.y;
            if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            if (dx < 0 && props.nextHref) router.push(props.nextHref);
            if (dx > 0 && props.prevHref) router.push(props.prevHref);
          }}>
          <div className="pv-frame">
            <div className="pv-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.imgUrl} alt={props.alt} />
              {props.prevHref && <Link href={props.prevHref} className="pv-arrow prev" aria-label="Previous photo"><Icon name="chevronLeft" size={22} /></Link>}
              {props.nextHref && <Link href={props.nextHref} className="pv-arrow next" aria-label="Next photo"><Icon name="chevronRight" size={22} /></Link>}
            </div>
            <div className="pv-under desktop-only">
              <div className="pv-cap-text">{heading}</div>
              <div className="pv-under-side">
                {!editing && (
                  <span className="pv-under-btns">
                    <FavoriteButton on={fav.on} onToggle={fav.toggle} />
                    <button type="button" className="btn pv-bar-btn" onClick={() => setEditing(true)}><Icon name="pencil" size={16} /> Edit details</button>
                  </span>
                )}
                <span className="pv-count">{count}</span>
              </div>
            </div>
            {askCard && <div className="pv-under pv-under-card desktop-only">{askCard}</div>}
          </div>
        </div>

        {!editing && <div className="pv-caption phone-only"><div className="pv-cap-text">{heading}{askCard}</div></div>}
      </div>

      <aside className="pv-talk desktop-only" aria-label={nComments} aria-hidden={!talking} inert={!talking}>
        <div className="pv-talk-head">
          <h2>{n ? nComments : "Comments"}</h2>
          <button type="button" className="icon-btn" aria-label="Close comments" onClick={() => showTalk(false)}><Icon name="x" size={20} /></button>
        </div>
        <Thread photoId={props.photoId} comments={props.comments} me={props.me} />
      </aside>

      {!editing && (
        <button type="button" className="pv-talkbar phone-only" onClick={() => setSheet(n ? "read" : "write")} aria-haspopup="dialog">
          <span className="sheet-grip" aria-hidden="true" />
          <span className="pv-talkbar-row">
            <Icon name="comment" size={22} />
            <strong>{n ? "Show comments" : "Leave a comment"}</strong>
            {n > 0 && <span className="pv-talkbar-count" aria-label={nComments}>{n}</span>}
          </span>
        </button>
      )}
      {sheet && !editing && (
        <>
          <div className="pv-sheet-backdrop phone-only" onClick={() => setSheet(false)} aria-hidden="true" />
          <aside className="pv-talksheet phone-only" role="dialog" aria-label={nComments}>
            <button type="button" className="sheet-grip-btn" onClick={() => setSheet(false)} aria-label="Close comments"><span className="sheet-grip" aria-hidden="true" /></button>
            <h2>{n ? nComments : "Comments"}</h2>
            <Thread photoId={props.photoId} comments={props.comments} me={props.me} compose="Write a comment" focus={sheet === "write"} />
          </aside>
        </>
      )}

      {editing && (
        <>
          <div className="pv-sheet-backdrop phone-only" onClick={() => setEditing(false)} aria-hidden="true" />
          <aside className="pv-panel" role="dialog" aria-label="Edit details">
            <div className="sheet-grip phone-only" aria-hidden="true" />
            <PhotoDetails d={props.details} tagHref={props.tagHref} onDone={() => { setEditing(false); setHelping(false); }}
              helping={helping} onThanks={() => setThanks({ text: "Thanks for tagging!", star: false, key: Date.now() })}
              avatarFor={props.avatarFor}
              onAvatar={async (p) => {
                try { await post(`/api/people/${p.id}`, "PATCH", { avatarPhotoId: props.photoId }); setNote(`Now ${p.name}'s profile photo.`); router.refresh(); }
                catch (e) { setNote((e as Error).message); }
              }}
              onRemove={props.canDelete ? () => setConfirming(true) : undefined} />
          </aside>
        </>
      )}

      <FavoriteToast toast={thanks ?? fav.toast} />

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
            try { await post(`/api/photos/${props.photoId}`, "DELETE"); window.location.assign(props.backHref); } catch (e) { setNote((e as Error).message); }
          }}
        />
      )}
    </div>
  );
}
