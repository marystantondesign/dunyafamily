"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookSketch } from "./Sketches";
import { Icon } from "./Icon";
import { StoryFace } from "./StoriesIndex";
import { StoryPhotoPicker, type PickedPhoto } from "./StoryPhotoPicker";
import { forPhone, prepare, put, whenVisible, type Item } from "./Uploader";

type Person = { id: number; name: string; aliases: string[]; avatarUrl: string | null; inMemory: boolean };
/** A chosen photo: one already in the family archive (linked, never re-uploaded), or one from this device. */
type Pic = { kind: "archive"; id: number; url: string | null } | { kind: "device"; item: Item };
const MAX = 10;
const first = (n: string) => n.split(/\s+/)[0];
const picKey = (p: Pic) => (p.kind === "archive" ? `a${p.id}` : `d${p.item.key}`);

/**
 * Submit a story: who it's about, an optional title, the story, and optional photos. It goes to Mary privately and
 * can't be seen or edited again after sending. Photos from the device stay private (never in the family archive);
 * archive photos are linked by id.
 */
export function SubmitStory({ me, people, start }: { me: { name: string; avatarUrl: string | null; inMemory: boolean }; people: Person[]; start: number[] }) {
  const router = useRouter();
  const [about, setAbout] = useState<number[]>(start);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pics, setPics] = useState<Pic[]>([]);
  const [adding, setAdding] = useState(false);
  const [find, setFind] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typed = !!(title.trim() || body.trim() || pics.length);
  const typedRef = useRef(false);
  typedRef.current = typed && !sent;

  // Leaving with something written asks first.
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (typedRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);
  // The photo choice closes with Escape or a click outside it.
  useEffect(() => {
    if (!choosing) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setChoosing(false); };
    const down = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setChoosing(false); };
    window.addEventListener("keydown", key);
    window.addEventListener("mousedown", down);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("mousedown", down); };
  }, [choosing]);

  const byId = new Map(people.map((p) => [p.id, p]));
  const chosen = about.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const options = people.filter((p) => !about.includes(p.id) && (!find.trim() || [p.name, ...p.aliases].some((n) => n.toLowerCase().includes(find.trim().toLowerCase()))));
  const archived = pics.filter((p): p is Extract<Pic, { kind: "archive" }> => p.kind === "archive");

  async function fromDevice(list: FileList) {
    const files = [...list].slice(0, MAX - pics.length);
    const ready = (await Promise.all(files.map(prepare))).filter((i) => i.state === "ready");
    setPics((cur) => [...cur, ...ready.map((item) => ({ kind: "device" as const, item }))].slice(0, MAX));
  }

  // The archive picker returns everything picked there; photos picked before keep their place.
  function fromArchive(list: PickedPhoto[]) {
    setPics((cur) => {
      const keep = cur.filter((p) => p.kind === "device" || list.some((x) => x.id === p.id));
      const added = list.filter((x) => !cur.some((p) => p.kind === "archive" && p.id === x.id)).map((x) => ({ kind: "archive" as const, id: x.id, url: x.url }));
      return [...keep, ...added].slice(0, MAX);
    });
    setArchive(false);
  }

  async function send() {
    if (!body.trim()) { setError("Write the story before sending it."); storyRef.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const device = pics.flatMap((p) => (p.kind === "device" ? [p.item] : []));
      let uploaded: { key: string; thumbKey: string }[] = [];
      if (device.length) {
        const res = await fetch("/api/stories/submit/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: device.length }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
        const spots: { key: string; thumbKey: string; url: string; thumbUrl: string }[] = await res.json();
        for (let i = 0; i < device.length; i++) {
          const img = await forPhone(device[i].body ?? device[i].file);
          await whenVisible();
          await put(spots[i].url, img.blob, "image/jpeg");
          await put(spots[i].thumbUrl, device[i].thumb!, "image/jpeg");
        }
        uploaded = spots.map(({ key, thumbKey }) => ({ key, thumbKey }));
      }
      const res = await fetch("/api/stories/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about, title, body, photos: uploaded, photoIds: archived.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      setSent(true);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That didn't send. Try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="ss-thanks">
        <BookSketch height={84} />
        <h1>Thank you</h1>
        <p>Your story has been sent to Mary. Thank you for helping preserve our family’s memories.</p>
        <Link href="/stories" className="ss-send">Back to In Her Words</Link>
      </div>
    );
  }

  const leave = (e?: React.MouseEvent) => {
    if (typedRef.current && !window.confirm("Leave without sending your story?")) { e?.preventDefault(); return false; }
    typedRef.current = false;
    return true;
  };

  return (
    <div className="ss-page">
      <Link href="/stories" className="sf-back" onClick={(e) => leave(e)}><Icon name="chevronLeft" size={18} />In Her Words</Link>
      <h1>Submit a story</h1>
      <p className="ss-intro">Share a favorite memory about Mammaw or a funny story about someone else in the family. If you sit with Mammaw as she tells you a story about her life, and she’s okay with it being shared here, that’s perfect.</p>
      <p className="ss-intro">When you submit this story, it will go to Mary for a future Family Stories project. It won’t be published on the site just yet. Stay tuned.</p>
      <div className="ss-from"><StoryFace p={me} size={32} /><span>Sending as <strong>{me.name}</strong></span></div>

      <div className="sf-field">
        <span className="sf-label">Who is this story about?</span>
        <div className="sf-chips">
          {chosen.map((p) => (
            <span key={p.id} className="sf-person">
              <StoryFace p={p} size={28} />{first(p.name)}
              <button type="button" aria-label={`Remove ${first(p.name)}`} onClick={() => setAbout((a) => a.filter((x) => x !== p.id))}><Icon name="x" size={16} stroke={2} /></button>
            </span>
          ))}
          <div className="sf-addp-wrap">
            <button type="button" className="sf-addp" aria-expanded={adding} onClick={() => { setAdding(!adding); setFind(""); }}><Icon name="plus" size={16} stroke={2.4} />Add person</button>
            {adding && (
              <div className="sf-pop" role="dialog" aria-label="Add a person" onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}>
                <input type="search" autoFocus placeholder="Search family" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search family" />
                <ul>
                  {options.slice(0, 60).map((p) => (
                    <li key={p.id}><button type="button" onClick={() => { setAbout((a) => [...a, p.id]); setAdding(false); }}><StoryFace p={p} size={28} />{p.name}</button></li>
                  ))}
                  {!options.length && <li className="sf-none">No one by that name</li>}
                </ul>
                <button type="button" className="sf-link" onClick={() => setAdding(false)}>Done</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <label className="sf-field">
        <span className="sf-label">Title <span className="sf-opt">(optional)</span></span>
        <input type="text" className="ss-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give it a name" maxLength={200} />
      </label>

      <div className="sf-field">
        <label className="sf-label" htmlFor="ss-story">The story</label>
        <textarea id="ss-story" ref={storyRef} className="ss-story" value={body} onChange={(e) => { setBody(e.target.value); setError(""); }} placeholder="Tell it the way you’d tell it at the dinner table." />
        <p className="ss-voice"><Icon name="mic" size={16} />Prefer telling your story out loud? Voice recordings are coming in a future update.</p>
      </div>

      <div className="sf-field">
        <span className="sf-label">Photos <span className="sf-opt">(optional)</span></span>
        <div className="ss-photos">
          {pics.map((p) => {
            const src = p.kind === "archive" ? p.url : p.item.preview;
            return (
              <span key={picKey(p)} className="ss-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src && <img src={src} alt="" />}
                <button type="button" aria-label="Remove photo" onClick={() => setPics((cur) => cur.filter((x) => picKey(x) !== picKey(p)))}><Icon name="x" size={14} stroke={2.4} /></button>
              </span>
            );
          })}
          {pics.length < MAX && (
            <div className="ss-add-wrap" ref={menuRef}>
              <button type="button" className="sf-btn" aria-haspopup="menu" aria-expanded={choosing} onClick={() => setChoosing(!choosing)}>
                <Icon name="photo" size={18} />{pics.length ? "Add more" : "Add photos"}
              </button>
              {choosing && (
                <>
                  {/* Desktop: a small menu under the button. */}
                  <div className="ss-drop desktop-only" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setChoosing(false); setArchive(true); }}><Icon name="album" size={18} />Choose from archive</button>
                    <button type="button" role="menuitem" onClick={() => { setChoosing(false); fileRef.current?.click(); }}><Icon name="upload" size={18} />Upload from device</button>
                  </div>
                  {/* Phone: an action sheet. */}
                  <div className="ss-sheet-back phone-only" onClick={() => setChoosing(false)}>
                    <div className="ss-sheet" role="menu" aria-label="Add photos to your story" onClick={(e) => e.stopPropagation()}>
                      <div className="ss-sheet-group">
                        <p>Add photos to your story</p>
                        <button type="button" role="menuitem" onClick={() => { setChoosing(false); setArchive(true); }}>Choose from archive</button>
                        <button type="button" role="menuitem" onClick={() => { setChoosing(false); fileRef.current?.click(); }}>Upload from device</button>
                      </div>
                      <button type="button" className="ss-sheet-cancel" onClick={() => setChoosing(false)}>Cancel</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { if (e.target.files) fromDevice(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {error && <p className="sf-missing" role="alert">{error}</p>}
      <div className="ss-actions">
        <button type="button" className="sf-save" disabled={busy} onClick={() => { if (leave()) router.push("/stories"); }}>Cancel</button>
        <button type="button" className="ss-send" disabled={busy} onClick={send}>{busy ? "Sending" : "Send to Mary"}</button>
      </div>

      {archive && (
        <StoryPhotoPicker multi archiveOnly people={chosen.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, inMemory: p.inMemory }))}
          already={archived.map((p) => ({ id: p.id, url: p.url }))} onClose={() => setArchive(false)} onAdd={fromArchive} />
      )}
    </div>
  );
}
