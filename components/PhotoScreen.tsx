"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Icon } from "./Icon";
import { PhotoDetails, type DetailsData } from "./PhotoDetails";
import { Reactions, Thread, type Comment, type Reaction } from "./PhotoTalk";

/**
 * The photo page (mockups 3, 4, 8, and 9). View mode shows only the photo, fitted to the window, with round
 * Previous and Next buttons (arrow keys and swiping work too) and a caption row. Edit details opens a panel on
 * the right on desktop and a sheet on phones, with the photo still in view.
 */
const TALK_KEY = "df_talk_hidden";

export function PhotoScreen(props: {
  photoId: number; imgUrl: string; thumbUrl: string; alt: string;
  title: string; people: { id: number; name: string }[]; addedBy: string;
  pos: number | null; total: number | null; prevHref?: string; nextHref?: string;
  backHref: string; backLabel: string; slideshowHref: string; tagHref: string;
  canDelete: boolean; avatarFor: { id: number; name: string }[];
  details: DetailsData;
  comments: Comment[]; reactions: Reaction[]; me: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Comments sit beside the photo on desktop (Hide puts them away, remembered on this device) and in a sheet on phones.
  const [talkHidden, setTalkHidden] = useState(false);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { try { setTalkHidden(localStorage.getItem(TALK_KEY) === "1"); } catch { /* private window */ } }, []);
  const hideTalk = (on: boolean) => { setTalkHidden(on); try { localStorage.setItem(TALK_KEY, on ? "1" : "0"); } catch { /* private window */ } };
  const talking = !editing && !talkHidden;
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const touch = useRef<{ x: number; y: number } | null>(null);
  const menuBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.prevHref) router.prefetch(props.prevHref);
    if (props.nextHref) router.prefetch(props.nextHref);
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, select, [role=dialog]")) return;
      if (e.key === "ArrowLeft" && props.prevHref) router.push(props.prevHref);
      if (e.key === "ArrowRight" && props.nextHref) router.push(props.nextHref);
      if (e.key === "Escape") { setMenu(false); setEditing(false); setSheet(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.prevHref, props.nextHref, router]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (!menuBox.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menu]);

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

  const n = props.comments.length;
  const nComments = `${n} ${n === 1 ? "comment" : "comments"}`;
  const latest = props.comments.reduce<Comment | null>((a, c) => (!a || c.createdAt >= a.createdAt ? c : a), null);
  const heading = (
    <>
      <h1>{props.title}</h1>
      <p>{withLine}{props.addedBy}.</p>
      {note && <p className="pv-note" role="status">{note}</p>}
    </>
  );

  const options = (
    <ul className="pv-menu-list">
      <li className="phone-only"><button type="button" onClick={() => { setMenu(false); setEditing(true); }}><Icon name="pencil" size={20} /> Edit details</button></li>
      <li><a href={`/api/photos/${props.photoId}/download`}><Icon name="download" size={20} /> Download original</a></li>
      {props.avatarFor.map((p) => (
        <li key={p.id}>
          <button type="button" onClick={async () => {
            setMenu(false);
            try { await post(`/api/people/${p.id}`, "PATCH", { avatarPhotoId: props.photoId }); setNote(`Now ${p.name}'s profile photo.`); router.refresh(); } catch (e) { setNote((e as Error).message); }
          }}><Icon name="person" size={20} /> Use as {p.name}&apos;s profile photo</button>
        </li>
      ))}
      {props.canDelete && (
        <li><button type="button" className="danger" onClick={() => { setMenu(false); setConfirming(true); }}><Icon name="trash" size={20} /> Delete photo</button></li>
      )}
    </ul>
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
          {editing ? <span className="pv-count desktop-only">{count}</span> : (
            <span className="pv-tools" ref={menuBox}>
              <Link href={props.slideshowHref} className="btn desktop-only"><Icon name="play" size={14} /> Slideshow</Link>
              <Link href={props.slideshowHref} className="icon-btn phone-only" aria-label="Slideshow"><Icon name="play" size={20} /></Link>
              <button type="button" className="btn desktop-only" onClick={() => setEditing(true)}><Icon name="pencil" size={16} /> Edit details</button>
              <button type="button" className="btn pv-more" aria-label="More options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="more" size={20} /></button>
              {menu && (
                <>
                  <div className="ss-backdrop phone-only" onClick={() => setMenu(false)} aria-hidden="true" />
                  <div className="pv-menu" role="menu">
                    <div className="sheet-grip phone-only" aria-hidden="true" />
                    <p className="small muted pv-menu-added">{props.addedBy}</p>
                    {options}
                  </div>
                </>
              )}
            </span>
          )}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.imgUrl} alt={props.alt} />
          {props.prevHref && <Link href={props.prevHref} className="pv-arrow prev" aria-label="Previous photo"><Icon name="chevronLeft" size={22} /></Link>}
          {props.nextHref && <Link href={props.nextHref} className="pv-arrow next" aria-label="Next photo"><Icon name="chevronRight" size={22} /></Link>}
        </div>

        {!editing && (
          <div className="pv-caption">
            <div className="pv-cap-text">
              {heading}
              <Reactions photoId={props.photoId} reactions={props.reactions} comments={n} onComments={() => hideTalk(false)} />
            </div>
            <span className="pv-count desktop-only">{count}</span>
          </div>
        )}
      </div>

      {talking && (
        <aside className="pv-talk desktop-only" aria-label="Comments">
          <div className="pv-talk-head">
            <div>{heading}</div>
            <button type="button" className="btn pv-hide" onClick={() => hideTalk(true)}>Hide <Icon name="chevronRight" size={14} /></button>
          </div>
          <div className="pv-talk-react">
            <Reactions photoId={props.photoId} reactions={props.reactions} comments={n} countOnly />
          </div>
          <Thread photoId={props.photoId} comments={props.comments} me={props.me} />
        </aside>
      )}

      {!editing && (
        <button type="button" className="pv-talkbar phone-only" onClick={() => setSheet(true)} aria-haspopup="dialog">
          <span className="sheet-grip" aria-hidden="true" />
          <span className="pv-talkbar-row">
            <Icon name="comment" size={20} />
            <strong>{n ? nComments : "Comment"}</strong>
            <span className="pv-talkbar-last">{latest ? `${latest.author}: ${latest.body}` : "Share a memory about this photo"}</span>
            <Icon name="chevronUp" size={18} />
          </span>
        </button>
      )}
      {sheet && !editing && (
        <>
          <div className="pv-sheet-backdrop phone-only" onClick={() => setSheet(false)} aria-hidden="true" />
          <aside className="pv-talksheet phone-only" role="dialog" aria-label={nComments}>
            <button type="button" className="sheet-grip-btn" onClick={() => setSheet(false)} aria-label="Close comments"><span className="sheet-grip" aria-hidden="true" /></button>
            <h2>{n ? nComments : "Comments"}</h2>
            <Thread photoId={props.photoId} comments={props.comments} me={props.me} compose="Write a comment" />
          </aside>
        </>
      )}

      {editing && (
        <>
          <div className="pv-sheet-backdrop phone-only" onClick={() => setEditing(false)} aria-hidden="true" />
          <aside className="pv-panel" role="dialog" aria-label="Edit details">
            <div className="sheet-grip phone-only" aria-hidden="true" />
            <PhotoDetails d={props.details} tagHref={props.tagHref} onDone={() => setEditing(false)}
              onRemove={props.canDelete ? () => setConfirming(true) : undefined} />
          </aside>
        </>
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
            try { await post(`/api/photos/${props.photoId}`, "DELETE"); window.location.assign(props.backHref); } catch (e) { setNote((e as Error).message); }
          }}
        />
      )}
    </div>
  );
}
