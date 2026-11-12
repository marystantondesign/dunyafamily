"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookSketch } from "./Sketches";
import { Icon } from "./Icon";
import { StoryFace } from "./StoriesIndex";
import { StoryPhotoPicker, type PickedPhoto } from "./StoryPhotoPicker";

type Person = { id: number; name: string; aliases: string[]; avatarUrl: string | null; inMemory: boolean };
/** A chosen photo, linked by its id in the family archive (new uploads go into the archive first, like any upload). */
type Pic = { id: number; url: string | null };
const MAX = 10;
const first = (n: string) => n.split(/\s+/)[0];

/**
 * Submit a story: who it's about, an optional title, the story, and optional photos. It goes to Mary privately and
 * can't be seen or edited again after sending. Photos come from the same picker as Mary's Add a story: family photos
 * (linked by id, never re-uploaded) or new uploads (into the family archive, tagged with the people in the story).
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
  const [picker, setPicker] = useState<"site" | "upload" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
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
  // The picker returns everything picked there; photos picked before keep their place.
  function fromPicker(list: PickedPhoto[]) {
    setPics((cur) => {
      const keep = cur.filter((p) => list.some((x) => x.id === p.id));
      const added = list.filter((x) => !cur.some((p) => p.id === x.id)).map((x) => ({ id: x.id, url: x.url }));
      return [...keep, ...added].slice(0, MAX);
    });
    setPicker(null);
  }

  async function send() {
    if (!body.trim()) { setError("Write the story before sending it."); storyRef.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/stories/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about, title, body, photoIds: pics.map((p) => p.id) }),
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
          {pics.map((p) => (
            <span key={p.id} className="ss-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.url && <img src={p.url} alt="" />}
              <button type="button" aria-label="Remove photo" onClick={() => setPics((cur) => cur.filter((x) => x.id !== p.id))}><Icon name="x" size={14} stroke={2.4} /></button>
            </span>
          ))}
          {pics.length < MAX && (
            <div className="ss-add-wrap" ref={menuRef}>
              <button type="button" className="sf-btn" aria-haspopup="menu" aria-expanded={choosing} onClick={() => setChoosing(!choosing)}>
                <Icon name="photo" size={18} />{pics.length ? "Add more" : "Add photos"}
              </button>
              {choosing && (
                <>
                  {/* Desktop: a small menu under the button. */}
                  <div className="ss-drop desktop-only" role="menu">
                    <button type="button" role="menuitem" onClick={() => { setChoosing(false); setPicker("site"); }}><Icon name="album" size={18} />Choose from archive</button>
                    <button type="button" role="menuitem" onClick={() => { setChoosing(false); setPicker("upload"); }}><Icon name="upload" size={18} />Upload from device</button>
                  </div>
                  {/* Phone: an action sheet. */}
                  <div className="ss-sheet-back phone-only" onClick={() => setChoosing(false)}>
                    <div className="ss-sheet" role="menu" aria-label="Add photos to your story" onClick={(e) => e.stopPropagation()}>
                      <div className="ss-sheet-group">
                        <p>Add photos to your story</p>
                        <button type="button" role="menuitem" onClick={() => { setChoosing(false); setPicker("site"); }}>Choose from archive</button>
                        <button type="button" role="menuitem" onClick={() => { setChoosing(false); setPicker("upload"); }}>Upload from device</button>
                      </div>
                      <button type="button" className="ss-sheet-cancel" onClick={() => setChoosing(false)}>Cancel</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <p className="sf-missing" role="alert">{error}</p>}
      <div className="ss-actions">
        <button type="button" className="sf-save" disabled={busy} onClick={() => { if (leave()) router.push("/stories"); }}>Cancel</button>
        <button type="button" className="ss-send" disabled={busy} onClick={send}>{busy ? "Sending" : "Send to Mary"}</button>
      </div>

      {picker && (
        <StoryPhotoPicker multi startTab={picker} people={chosen.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, inMemory: p.inMemory }))}
          already={pics} onClose={() => setPicker(null)} onAdd={fromPicker} />
      )}
    </div>
  );
}
