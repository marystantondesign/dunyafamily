"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookSketch } from "./Sketches";
import { Icon } from "./Icon";
import { StoryFace } from "./StoriesIndex";
import { forPhone, prepare, put, whenVisible, type Item } from "./Uploader";

type Person = { id: number; name: string; aliases: string[]; avatarUrl: string | null; inMemory: boolean };
const first = (n: string) => n.split(/\s+/)[0];

/**
 * Submit a story: who it's about, an optional title, the story, and optional photos. It goes to Mary privately
 * (photos too, never into the family archive) and can't be edited after sending.
 */
export function SubmitStory({ me, people, start }: { me: { name: string; avatarUrl: string | null; inMemory: boolean }; people: Person[]; start: number[] }) {
  const router = useRouter();
  const [about, setAbout] = useState<number[]>(start);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<Item[]>([]);
  const [adding, setAdding] = useState(false);
  const [find, setFind] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLTextAreaElement>(null);
  const typed = !!(title.trim() || body.trim() || photos.length);
  const typedRef = useRef(false);
  typedRef.current = typed && !sent;

  // Leaving with something written asks first.
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (typedRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, []);

  const byId = new Map(people.map((p) => [p.id, p]));
  const chosen = about.map((id) => byId.get(id)).filter((p): p is Person => !!p);
  const options = people.filter((p) => !about.includes(p.id) && (!find.trim() || [p.name, ...p.aliases].some((n) => n.toLowerCase().includes(find.trim().toLowerCase()))));

  async function pick(list: FileList) {
    const files = [...list].slice(0, 10 - photos.length);
    const ready = (await Promise.all(files.map(prepare))).filter((i) => i.state === "ready");
    setPhotos((cur) => [...cur, ...ready].slice(0, 10));
  }

  async function send() {
    if (!body.trim()) { setError("Write the story before sending it."); storyRef.current?.focus(); return; }
    setBusy(true); setError("");
    try {
      let uploaded: { key: string; thumbKey: string }[] = [];
      if (photos.length) {
        const res = await fetch("/api/stories/submit/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: photos.length }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
        const spots: { key: string; thumbKey: string; url: string; thumbUrl: string }[] = await res.json();
        for (let i = 0; i < photos.length; i++) {
          const img = await forPhone(photos[i].body ?? photos[i].file);
          await whenVisible();
          await put(spots[i].url, img.blob, "image/jpeg");
          await put(spots[i].thumbUrl, photos[i].thumb!, "image/jpeg");
        }
        uploaded = spots.map(({ key, thumbKey }) => ({ key, thumbKey }));
      }
      const res = await fetch("/api/stories/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about, title, body, photos: uploaded }),
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
        <p>Your story is on its way to Mary. She’ll keep it safe for a future project.</p>
        <Link href="/stories" className="ss-send">Back to In Her Words</Link>
      </div>
    );
  }

  return (
    <div className="ss-page">
      <Link href="/stories" className="sf-back" onClick={(e) => { if (typedRef.current && !window.confirm("Leave without sending your story?")) e.preventDefault(); }}><Icon name="chevronLeft" size={18} />In Her Words</Link>
      <h1>Submit a story</h1>
      <p className="ss-intro">Share a story about someone in our family. It goes straight to Mary for a future project. It won’t be posted on the site, and you can’t edit it after you send it.</p>
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

      <label className="sf-field">
        <span className="sf-label">The story</span>
        <textarea ref={storyRef} className="ss-story" value={body} onChange={(e) => { setBody(e.target.value); setError(""); }} placeholder="Tell it the way you’d tell it at the dinner table." />
      </label>

      <div className="sf-field">
        <span className="sf-label">Photos <span className="sf-opt">(optional)</span></span>
        <div className="ss-photos">
          {photos.map((p) => (
            <span key={p.key} className="ss-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.preview && <img src={p.preview} alt="" />}
              <button type="button" aria-label="Remove this photo" onClick={() => setPhotos((cur) => cur.filter((x) => x.key !== p.key))}><Icon name="x" size={14} stroke={2.4} /></button>
            </span>
          ))}
          {!photos.length && <span className="ss-thumb empty" aria-hidden="true" />}
          {photos.length < 10 && <button type="button" className="sf-btn" onClick={() => fileRef.current?.click()}><Icon name="photo" size={18} />Add photos</button>}
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { if (e.target.files) pick(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      {error && <p className="sf-missing" role="alert">{error}</p>}
      <div className="ss-actions">
        <button type="button" className="sf-save" disabled={busy} onClick={() => { if (!typedRef.current || window.confirm("Leave without sending your story?")) { typedRef.current = false; router.push("/stories"); } }}>Cancel</button>
        <button type="button" className="ss-send" disabled={busy} onClick={send}>{busy ? "Sending" : "Send to Mary"}</button>
      </div>
    </div>
  );
}
