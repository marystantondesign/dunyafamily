"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TagPicker, type Option, type Picked } from "./TagPicker";

const THEMES = [
  ["growing-up", "Growing up"], ["family", "Family"], ["school-and-work", "School and work"],
  ["love-and-marriage", "Love and marriage"], ["raising-kids", "Raising kids"], ["favorites-and-advice", "Favorites and advice"],
] as const;
const DECADES = Array.from({ length: 10 }, (_, i) => 1930 + i * 10);

async function send(url: string, body: unknown) {
  const res = await fetch(url, { method: url.includes("/api/stories/") && !url.endsWith("/pin") ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error ?? "That didn't save. Try again.");
  return out;
}

/** Mary's admin list: Import from Notion. */
export function StoriesAdminTools() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="actions" style={{ marginTop: 0, alignItems: "center" }}>
      {note && <span className="small" role="status">{note}</span>}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
        setBusy(true); setNote("Bringing stories over. This can take a minute.");
        try { const r = await (await fetch("/api/admin/stories/import", { method: "POST" })).json(); setNote(r.message ?? r.error); router.refresh(); }
        catch { setNote("The import didn't work. Try again."); }
        setBusy(false);
      }}>{busy ? "Importing" : "Import from Notion"}</button>
    </div>
  );
}

type Story = { id: number; title: string; question: string; body: string; heroPhotoId: number | null; heroCaption: string; theme: string; people: number[]; occasions: number[]; decades: number[]; status: string };

/** Edit one story: everything on its page, and publish or unpublish it. */
export function StoryEditor({ story, people, occasions, pinned }: { story: Story; people: Option[]; occasions: Option[]; pinned: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(story);
  const [who, setWho] = useState<Picked[]>(story.people);
  const [occ, setOcc] = useState<Picked[]>(story.occasions);
  const [hero, setHero] = useState(story.heroPhotoId ? String(story.heroPhotoId) : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const set = (patch: Partial<Story>) => setS((x) => ({ ...x, ...patch }));

  async function save(status?: "draft" | "published") {
    setBusy(true); setErr(""); setMsg("");
    // A photo's number is at the end of its address, like /photos/123.
    const heroId = Number((hero.match(/(\d+)\s*$/) ?? [])[1]) || null;
    try {
      await send(`/api/stories/${s.id}`, {
        title: s.title, question: s.question, body: s.body, theme: s.theme || null, heroPhotoId: heroId, heroCaption: s.heroCaption,
        people: who.filter((p): p is number => typeof p === "number"), occasions: occ.filter((p): p is number => typeof p === "number"), decades: s.decades,
        ...(status ? { status } : {}),
      });
      if (status) set({ status });
      setMsg(status === "published" ? "Published." : status === "draft" ? "Moved back to drafts." : "Saved.");
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="story-editor form-grid">
      <div className="edit-head">
        <h1 className="display">{s.title || "New story"}</h1>
        <p className="small muted">{s.status === "published" ? "Published" : "Draft"}</p>
      </div>
      <div className="field"><label htmlFor="st-title">Title</label><input id="st-title" value={s.title} onChange={(e) => set({ title: e.target.value })} placeholder="The neighborhood" /></div>
      <div className="field"><label htmlFor="st-q">The question</label><textarea id="st-q" rows={2} value={s.question} onChange={(e) => set({ question: e.target.value })} /></div>
      <div className="field">
        <label htmlFor="st-theme">Theme</label>
        <select id="st-theme" value={s.theme} onChange={(e) => set({ theme: e.target.value })}>
          <option value="">Choose a theme</option>
          {THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <TagPicker label="People it mentions" options={people} value={who} onChange={(v) => setWho(v.filter((p) => typeof p === "number"))} placeholder="Start typing a name" />
      <TagPicker label="Occasions" options={occasions} value={occ} onChange={(v) => setOcc(v.filter((p) => typeof p === "number"))} placeholder="Christmas, Easter" />
      <fieldset className="field story-decades">
        <legend>Decades</legend>
        {DECADES.map((d) => (
          <label key={d} className="check-inline">
            <input type="checkbox" checked={s.decades.includes(d)} onChange={() => set({ decades: s.decades.includes(d) ? s.decades.filter((x) => x !== d) : [...s.decades, d] })} /> {d}s
          </label>
        ))}
      </fieldset>
      <div className="row-2">
        <div className="field"><label htmlFor="st-hero">Top photo</label><input id="st-hero" value={hero} onChange={(e) => setHero(e.target.value)} placeholder="Paste the photo's link" />
          <span className="hint">Open the photo on the site and copy its address. Leave blank for none.</span></div>
        <div className="field"><label htmlFor="st-cap">Its caption</label><input id="st-cap" value={s.heroCaption} onChange={(e) => set({ heroCaption: e.target.value })} placeholder="Who and when" /></div>
      </div>
      <div className="field">
        <label htmlFor="st-body">Her answer</label>
        <textarea id="st-body" rows={18} value={s.body} onChange={(e) => set({ body: e.target.value })} />
        <span className="hint">Leave a blank line between paragraphs. To put a photo in the story, add a line like [photo 123] and its caption, using the number from the photo&apos;s address.</span>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      {msg && <p className="small" role="status">{msg}</p>}
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={() => save()}>Save</button>
        {s.status === "published"
          ? <button type="button" className="btn" disabled={busy} onClick={() => save("draft")}>Move back to drafts</button>
          : <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save("published")}>Publish</button>}
        {s.status === "published" && (
          <button type="button" className="btn" disabled={busy} onClick={async () => { await send("/api/stories/pin", { id: pinned ? null : s.id }); router.refresh(); }}>
            {pinned ? "Unpin from featured" : "Pin as featured"}
          </button>
        )}
        {s.status === "published" && <a className="btn" href={`/stories/${s.id}`}>View story</a>}
      </div>
    </div>
  );
}
