"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EditBlock, StoryForm as Form, StoryTab } from "@/lib/storyAdmin";
import { Icon } from "./Icon";
import { StoryFace } from "./StoriesIndex";
import { StoryPhotoPicker, type PickedPhoto } from "./StoryPhotoPicker";

const THEMES = [
  ["growing-up", "Growing up"], ["family", "Family"], ["school-and-work", "School and work"],
  ["love-and-marriage", "Love and marriage"], ["raising-kids", "Raising kids"], ["favorites-and-advice", "Favorites and advice"],
] as const;
const DECADES = Array.from({ length: 11 }, (_, i) => 1920 + i * 10);
const HIDE = "This will hide the story from everyone. Continue?";
const LEAVE = "You have changes that aren't saved. Leave anyway?";

type Person = { id: number; name: string; aliases: string[]; avatarUrl: string | null; inMemory: boolean };
type Block = EditBlock & { key: string };
type Missing = "title" | "answer" | "theme";

let keySeq = 0;
const nextKey = () => `b${++keySeq}`;
const text = (t: string): Block => ({ kind: "text", text: t, key: nextKey() });
const paras = (t: string) => t.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
const joinText = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join("\n\n");

/** Keeps the editor as text, photo, text, photo, ... text: neighbors merge, and a text block follows every photo. */
function normalize(list: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of list) {
    const last = out[out.length - 1];
    if (b.kind === "text") {
      if (last?.kind === "text") out[out.length - 1] = { ...last, text: joinText(last.text, b.text) };
      else out.push(b);
    } else {
      if (!last || last.kind !== "text") out.push(text(""));
      out.push(b);
    }
  }
  if (!out.length || out[out.length - 1].kind !== "text") out.push(text(""));
  return out;
}

/** The answer in the stored text format: paragraphs and "[photo 123] caption" lines, a blank line between each. */
function toBody(blocks: Block[]) {
  return blocks.flatMap((b) => {
    if (b.kind === "text") return paras(b.text);
    const cap = b.caption.replace(/\s+/g, " ").trim();
    return [`${b.kind === "photo" ? `[photo ${b.photoId}]` : `[image ${b.key}]`} ${cap}`.trim()];
  }).join("\n\n");
}

const wordCount = (blocks: Block[]) => blocks.reduce((n, b) => n + (b.kind === "text" ? b.text.split(/\s+/).filter(Boolean).length : 0), 0);

/** A text box that grows to fit what's in it (never scrolls inside). */
function GrowText({ value, onChange, className, ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  value: string; onChange: (v: string) => void; className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, []);
  useLayoutEffect(fit, [value, fit]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);
  return <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={className} {...rest} />;
}

/**
 * Add a story and edit a story (Mary only). Her answer is text blocks with photo blocks between them; photos go in
 * where the cursor was. Drafts and private stories save themselves a few seconds after typing stops; a published
 * story changes only when she presses Update.
 */
export function StoryForm({ initial, people, occasions }: { initial: Form; people: Person[]; occasions: { id: number; name: string }[] }) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(initial.id);
  const [saved, setSaved] = useState<StoryTab>(initial.status);
  const [title, setTitle] = useState(initial.title);
  const [question, setQuestion] = useState(initial.question);
  const [blocks, setBlocks] = useState<Block[]>(() => normalize(initial.blocks.map((b) => ({ ...b, key: b.kind === "image" ? b.key : nextKey() }))));
  const [hero, setHero] = useState(initial.hero);
  const [heroCaption, setHeroCaption] = useState(initial.heroCaption);
  const [recordedOn, setRecordedOn] = useState(initial.recordedOn);
  const [tagged, setTagged] = useState<number[]>(initial.people);
  const [theme, setTheme] = useState(initial.theme);
  const [occasion, setOccasion] = useState<number | null>(initial.occasion);
  const [decade, setDecade] = useState<number | null>(initial.decade);
  const [priv, setPriv] = useState(initial.status === "private");
  const [pinned, setPinned] = useState(initial.pinned);
  const [missing, setMissing] = useState<Missing | null>(null);
  const [picker, setPicker] = useState<null | { mode: "insert" } | { mode: "replace"; key: string } | { mode: "hero" }>(null);
  const [adding, setAdding] = useState(false);
  const [find, setFind] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Every change bumps the version; it's saved once the saved version catches up.
  const [version, setVersion] = useState(0);
  const savedVersion = useRef(0);
  const [, rerender] = useState(0);
  const dirty = version !== savedVersion.current;
  const cursor = useRef<{ key: string; pos: number } | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const idRef = useRef(id);
  idRef.current = id;
  const fieldRefs = useRef<Record<Missing, HTMLElement | null>>({ title: null, answer: null, theme: null });

  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setVersion((n) => n + 1); };
  const edit = () => setVersion((n) => n + 1);

  const peopleById = new Map(people.map((p) => [p.id, p]));
  const taggedPeople = tagged.map((t) => peopleById.get(t)).filter((p): p is Person => !!p);
  const words = wordCount(blocks);
  const minutes = Math.max(1, Math.ceil(words / 200));
  const status: StoryTab = priv ? "private" : saved === "published" ? "published" : "draft";
  const hasContent = !!(title.trim() || question.trim() || words || hero || blocks.length > 1);

  const payload = () => ({
    title, question, body: toBody(blocks), heroPhotoId: hero?.id ?? null, heroCaption, recordedOn, people: tagged,
    theme: theme || null, occasions: occasion ? [occasion] : [], decades: decade ? [decade] : [],
  });

  /** Saves (one at a time). New stories get their id from the first save, and the address follows. */
  const save = (next: StoryTab, quiet = false) => {
    const at = version;
    const body = { ...payload(), status: next };
    const run = chain.current.then(async () => {
      const cur = idRef.current;
      const res = await fetch(cur ? `/api/stories/${cur}` : "/api/stories", {
        method: cur ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(out.error ?? "That didn't save. Try again."), { missing: out.missing as Missing | undefined });
      if (!cur && out.id) { idRef.current = out.id; setId(out.id); window.history.replaceState(null, "", `/admin/stories/${out.id}`); }
      savedVersion.current = Math.max(savedVersion.current, at);
      setSaved(out.status);
      rerender((n) => n + 1);
      if (!quiet) setNote(out.status === "published" ? "Published" : out.status === "private" ? "Saved as private" : "Saved");
      else setNote("Saved");
      return out;
    });
    chain.current = run.catch(() => undefined);
    return run;
  };

  // Autosave drafts and private stories a few seconds after the last change.
  useEffect(() => {
    if (!dirty || saved === "published" || !hasContent) return;
    const t = setTimeout(() => { save(priv ? "private" : "draft", true).catch((e) => setNote(e.message)); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, saved, priv]);

  // Unsaved changes: ask before leaving, whether closing the tab or following a link.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty && hasContent;
  useEffect(() => {
    const unload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || !dirtyRef.current || a.target === "_blank" || e.defaultPrevented) return;
      if (!window.confirm(LEAVE)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, []);

  // Where photos go: the last spot the cursor was in her answer, forgotten when another field gets the focus.
  const track = (key: string) => (e: React.SyntheticEvent<HTMLTextAreaElement>) => { cursor.current = { key, pos: e.currentTarget.selectionStart }; };
  const onFocusAnywhere = (e: React.FocusEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest("[data-answer]") || el.closest("[data-keep-cursor]")) return;
    cursor.current = null;
  };

  const setText = (key: string, v: string) => {
    setBlocks((bs) => bs.map((b) => (b.key === key && b.kind === "text" ? { ...b, text: v } : b)));
    if (missing === "answer") setMissing(null);
    edit();
  };

  /** Paste keeps paragraph breaks (each line break becomes a new paragraph) and drops other formatting. */
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData("text/plain");
    if (!raw) return;
    e.preventDefault();
    const clean = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n\s*/g, "\n\n").replace(/\n{3,}/g, "\n\n");
    const el = e.currentTarget;
    if (!document.execCommand?.("insertText", false, clean)) {
      el.setRangeText(clean, el.selectionStart, el.selectionEnd, "end");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const photoBlock = (p: PickedPhoto): Block => ({ kind: "photo", photoId: p.id, url: p.url, caption: "", key: nextKey() });

  function insertPhotos(list: PickedPhoto[]) {
    setBlocks((bs) => {
      const at = cursor.current ? bs.findIndex((b) => b.key === cursor.current!.key && b.kind === "text") : -1;
      const i = at >= 0 ? at : bs.length - 1;
      const t = (bs[i] as Extract<Block, { kind: "text" }>).text;
      const pos = at >= 0 ? Math.min(cursor.current!.pos, t.length) : t.length;
      const mid = list.flatMap((p, k) => (k === 0 ? [photoBlock(p)] : [text(""), photoBlock(p)]));
      return normalize([...bs.slice(0, i), text(t.slice(0, pos).replace(/\s+$/, "")), ...mid, text(t.slice(pos).replace(/^\s+/, "")), ...bs.slice(i + 1)]);
    });
    cursor.current = null;
    edit();
  }

  /** Move a photo up or down one paragraph (or past the photo next to it when there's no writing between). */
  function move(key: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.key === key);
      const near = bs[i + dir] as Extract<Block, { kind: "text" }>;
      const far = bs[i - dir] as Extract<Block, { kind: "text" }>;
      const ps = paras(near.text);
      const out = [...bs];
      if (ps.length) {
        const moved = dir === -1 ? ps.pop()! : ps.shift()!;
        out[i + dir] = { ...near, text: ps.join("\n\n") };
        out[i - dir] = { ...far, text: dir === -1 ? joinText(moved, far.text) : joinText(far.text, moved) };
        return out;
      }
      const j = i + 2 * dir;
      if (out[j] && out[j].kind !== "text") [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
    edit();
  }
  const canMove = (i: number, dir: -1 | 1) => {
    const near = blocks[i + dir];
    return !!near && (paras(near.kind === "text" ? near.text : "").length > 0 || (!!blocks[i + 2 * dir] && blocks[i + 2 * dir].kind !== "text"));
  };

  const removePhoto = (key: string) => { setBlocks((bs) => normalize(bs.filter((b) => b.key !== key))); edit(); };
  const setCaption = (key: string, v: string) => { setBlocks((bs) => bs.map((b) => (b.key === key && b.kind !== "text" ? { ...b, caption: v } : b))); edit(); };

  function onPicked(list: PickedPhoto[]) {
    if (!picker || !list.length) { setPicker(null); return; }
    if (picker.mode === "insert") insertPhotos(list);
    else if (picker.mode === "hero") { setHero(list[0]); edit(); }
    else {
      const k = picker.key;
      setBlocks((bs) => bs.map((b) => (b.key === k && b.kind !== "text" ? { kind: "photo", photoId: list[0].id, url: list[0].url, caption: b.caption, key: b.key } : b)));
      edit();
    }
    setPicker(null);
  }

  function showMissing(m: Missing) {
    setMissing(m);
    const el = fieldRefs.current[m];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    (el?.querySelector?.("input, textarea, button") as HTMLElement | null)?.focus({ preventScroll: true });
  }

  async function run(next: StoryTab) {
    setBusy(true);
    try { await save(next); router.refresh(); }
    catch (e) {
      const m = (e as { missing?: Missing }).missing;
      if (m) showMissing(m); else setNote(e instanceof Error ? e.message : "That didn't save. Try again.");
    }
    setBusy(false);
  }

  function publish() {
    if (priv) return run("private");
    const m: Missing | null = !title.trim() ? "title" : !words ? "answer" : !theme ? "theme" : null;
    if (m) return showMissing(m);
    return run("published");
  }

  function saveDraft() {
    if (saved === "published" && !window.confirm(HIDE)) return;
    setPriv(false);
    run("draft");
  }

  function togglePrivate() {
    if (!priv && saved === "published") {
      if (!window.confirm(HIDE)) return;
      setPriv(true);
      run("private");
      return;
    }
    setPriv(!priv);
    edit();
  }

  async function pin(on: boolean) {
    if (!id) return;
    await fetch("/api/stories/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: on ? id : null }) });
    setPinned(on);
  }

  async function remove() {
    if (!id || !window.confirm("Remove this story? It can be brought back later if you need it.")) return;
    await fetch(`/api/stories/${id}`, { method: "DELETE" });
    dirtyRef.current = false;
    router.push("/admin/stories");
    router.refresh();
  }

  const options = people.filter((p) => !tagged.includes(p.id) && (!find.trim()
    || [p.name, ...p.aliases].some((n) => n.toLowerCase().includes(find.trim().toLowerCase()))));
  const mainLabel = priv ? "Save private" : saved === "published" ? "Update" : "Publish";
  const answerBlocks = blocks.filter((b) => b.kind === "text").length;
  let part = 0;

  return (
    <div className="sf-page" onFocus={onFocusAnywhere}>
      <Link href="/admin/stories" className="sf-back"><Icon name="chevronLeft" size={18} />My stories</Link>
      <div className="sf-heading">
        <h1>{id ? "Edit story" : "Add a story"}</h1>
        <span className={`sf-pill ${status}`}>{status === "private" ? "Private" : status === "published" ? "Published" : "Draft"}</span>
        <span className="sf-note" role="status" aria-live="polite">{dirty && hasContent && saved !== "published" ? "" : note}</span>
      </div>

      <div className="sf-cols">
        <section className="sf-writing">
          <label className="sf-field" ref={(el) => { fieldRefs.current.title = el; }}>
            <span className="sf-label">Title</span>
            <input type="text" className="sf-title" value={title} placeholder="Give it a catchy title" maxLength={200}
              onChange={(e) => { setTitle(e.target.value); if (missing === "title") setMissing(null); edit(); }} />
            {missing === "title" && <span className="sf-missing">Add a title to publish</span>}
          </label>
          <label className="sf-field">
            <span className="sf-label">The question you asked</span>
            <GrowText rows={2} className="sf-question" value={question} onChange={change(setQuestion)} maxLength={2000} />
          </label>
          <div className="sf-field" ref={(el) => { fieldRefs.current.answer = el; }}>
            <span className="sf-label-row"><span className="sf-label" id="sf-answer">Her answer</span><span className="sf-count">{words} {words === 1 ? "word" : "words"} · {minutes} min read</span></span>
            <div className="sf-blocks" data-answer>
              {blocks.map((b, i) => {
                if (b.kind === "text") {
                  part += 1;
                  return (
                    <GrowText key={b.key} className={`sf-answer${part > 1 ? " more" : ""}`} value={b.text} onChange={(v) => setText(b.key, v)}
                      aria-label={answerBlocks > 1 ? `Her answer, part ${part}` : "Her answer"}
                      placeholder={part === 1 ? "Type or paste her answer. Leave a blank line between paragraphs." : "Keep writing…"}
                      onSelect={track(b.key)} onKeyUp={track(b.key)} onClick={track(b.key)} onFocus={track(b.key)} onPaste={onPaste} />
                  );
                }
                return (
                  <div key={b.key} className="sf-photo">
                    <button type="button" className="sf-photo-img" aria-label="Change this photo" onClick={() => setPicker({ mode: "replace", key: b.key })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {b.url && <img src={b.url} alt="" />}
                      <span className="sf-change">Change photo</span>
                    </button>
                    <div className="sf-photo-side">
                      <span className="sf-photo-label">Photo in the story</span>
                      <input type="text" aria-label="Photo caption" placeholder="Caption, who and when" value={b.caption} maxLength={300} onChange={(e) => setCaption(b.key, e.target.value)} />
                      <div className="sf-photo-btns">
                        <button type="button" disabled={!canMove(i, -1)} onClick={() => move(b.key, -1)}>Move up</button>
                        <button type="button" disabled={!canMove(i, 1)} onClick={() => move(b.key, 1)}>Move down</button>
                        <button type="button" className="danger" onClick={() => removePhoto(b.key)}>Remove</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {missing === "answer" && <span className="sf-missing">Add her answer to publish</span>}
          </div>
          <div className="sf-add-photos" data-keep-cursor>
            <button type="button" className="sf-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => setPicker({ mode: "insert" })}>
              <Icon name="photo" size={18} />Add photos to the story
            </button>
            <span className="sf-hint">Photos go where your cursor is in her answer. Add as many as you like.</span>
          </div>
        </section>

        <aside className="sf-side">
          <div className="sf-field">
            <span className="sf-label">Main photo</span>
            <div className="sf-main">
              {hero?.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="sf-main-img" src={hero.url} alt="" />
                : <span className="sf-main-img empty" aria-hidden="true" />}
              <div className="sf-main-side">
                <button type="button" className="sf-btn wide" onClick={() => setPicker({ mode: "hero" })}>{hero ? "Change photo" : "Choose photo"}</button>
                <input type="text" aria-label="Main photo caption" placeholder="Caption, who and when" value={heroCaption} maxLength={300} onChange={(e) => change(setHeroCaption)(e.target.value)} />
                {hero && <button type="button" className="sf-link" onClick={() => { setHero(null); edit(); }}>Remove main photo</button>}
              </div>
            </div>
          </div>

          <label className="sf-field">
            <span className="sf-label">Date recorded</span>
            <input type="date" className="sf-input" value={recordedOn} onChange={(e) => change(setRecordedOn)(e.target.value)} />
            <span className="sf-hint">Today unless you change it.</span>
          </label>

          <div className="sf-field">
            <span className="sf-label">People in this story</span>
            <div className="sf-chips">
              {taggedPeople.map((p) => (
                <span key={p.id} className="sf-person">
                  <StoryFace p={p} size={28} />{p.name.split(/\s+/)[0]}
                  <button type="button" aria-label={`Remove ${p.name.split(/\s+/)[0]}`} onClick={() => { setTagged((t) => t.filter((x) => x !== p.id)); edit(); }}><Icon name="x" size={16} stroke={2} /></button>
                </span>
              ))}
              <div className="sf-addp-wrap">
                <button type="button" className="sf-addp" aria-expanded={adding} onClick={() => { setAdding(!adding); setFind(""); }}><Icon name="plus" size={16} stroke={2.4} />Add person</button>
                {adding && (
                  <div className="sf-pop" role="dialog" aria-label="Add a person" onKeyDown={(e) => { if (e.key === "Escape") setAdding(false); }}>
                    <input type="search" autoFocus placeholder="Search family" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Search family" />
                    <ul>
                      {options.slice(0, 60).map((p) => (
                        <li key={p.id}><button type="button" onClick={() => { setTagged((t) => [...t, p.id]); setAdding(false); edit(); }}><StoryFace p={p} size={28} />{p.name}</button></li>
                      ))}
                      {!options.length && <li className="sf-none">No one by that name</li>}
                    </ul>
                    <button type="button" className="sf-link" onClick={() => setAdding(false)}>Done</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sf-field" ref={(el) => { fieldRefs.current.theme = el; }}>
            <span className="sf-label" id="sf-theme">Theme</span>
            <div role="radiogroup" aria-labelledby="sf-theme" className="sf-chips tight">
              {THEMES.map(([slug, label]) => (
                <button key={slug} type="button" role="radio" aria-checked={theme === slug} className={`sf-theme${theme === slug ? " on" : ""}`}
                  onClick={() => { setTheme(slug); if (missing === "theme") setMissing(null); edit(); }}>{label}</button>
              ))}
            </div>
            {missing === "theme" && <span className="sf-missing">Choose a theme to publish</span>}
          </div>

          <div className="sf-tags">
            <label className="sf-field">
              <span className="sf-label">Occasions <span className="sf-opt">(optional)</span></span>
              <select className="sf-input" value={occasion ?? ""} onChange={(e) => change(setOccasion)(e.target.value ? Number(e.target.value) : null)}>
                <option value="">None</option>
                {occasions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="sf-field">
              <span className="sf-label">Decade <span className="sf-opt">(optional)</span></span>
              <select className="sf-input" value={decade ?? ""} onChange={(e) => change(setDecade)(e.target.value ? Number(e.target.value) : null)}>
                <option value="">None</option>
                {DECADES.map((d) => <option key={d} value={d}>{d}s</option>)}
              </select>
            </label>
          </div>

          <button type="button" role="switch" aria-checked={priv} className={`sf-private${priv ? " on" : ""}`} onClick={togglePrivate}>
            <span className="sf-private-text">
              <span className="sf-private-title">Keep private</span>
              <span className="sf-private-sub">Only you can see it. It never shows in In Her Words.</span>
            </span>
            <span className="sf-track" aria-hidden="true"><span className="sf-knob" /></span>
          </button>

          {id && (
            <div className="sf-extra">
              <Link href={`/stories/${id}`}>View story</Link>
              {saved === "published" && (pinned
                ? <button type="button" className="sf-link" onClick={() => pin(false)}>Pinned as featured. Unpin</button>
                : <button type="button" className="sf-link" onClick={() => pin(true)}>Pin as featured</button>)}
              <button type="button" className="sf-link danger" onClick={remove}>Remove story</button>
            </div>
          )}

          <div className="sf-actions">
            <button type="button" className="sf-save" disabled={busy} onClick={saveDraft}>Save draft</button>
            <button type="button" className={`sf-publish${priv ? " private" : ""}`} disabled={busy} onClick={publish}>{mainLabel}</button>
          </div>
        </aside>
      </div>

      {picker && (
        <StoryPhotoPicker multi={picker.mode === "insert"} people={taggedPeople} onClose={() => setPicker(null)} onAdd={onPicked} />
      )}
    </div>
  );
}
