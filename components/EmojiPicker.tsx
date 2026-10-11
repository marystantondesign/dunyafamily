"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The full emoji panel, like the one Control-Command-Space opens on a Mac: every emoji in one long scrolling
 * list with category headings, buttons that jump to a category, search, skin tones, and frequently used.
 * The list is the full Unicode set (public/emoji-data.json, copied from emoji-picker-element-data), drawn with
 * the device's own emoji. Emoji too new for this device are left out so nobody sees empty boxes.
 */
type Raw = { emoji: string; annotation: string; tags?: string[]; shortcodes?: string[]; group: number; order: number; version: number; skins?: { emoji: string; tone: number | number[] }[] };
type Emoji = Raw & { words: string };

const GROUPS: { name: string; icon: string; groups: number[] }[] = [
  { name: "Smileys and people", icon: "😀", groups: [0, 1] },
  { name: "Animals and nature", icon: "🐻", groups: [3] },
  { name: "Food and drink", icon: "🍔", groups: [4] },
  { name: "Activities", icon: "⚽", groups: [6] },
  { name: "Travel and places", icon: "🚗", groups: [5] },
  { name: "Objects", icon: "💡", groups: [7] },
  { name: "Symbols", icon: "💕", groups: [8] },
  { name: "Flags", icon: "🏁", groups: [9] },
];
const TONES = ["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"];
const RECENT_KEY = "df_emoji_recent";
const TONE_KEY = "df_emoji_tone";

let loaded: Promise<Emoji[]> | null = null;

/** Does this device draw the emoji in color? An emoji it doesn't know comes out as a plain box. */
function drawsInColor(ctx: CanvasRenderingContext2D, emoji: string) {
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillText(emoji, 0, 0);
  const px = ctx.getImageData(0, 0, 32, 32).data;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0 && (Math.abs(px[i] - px[i + 1]) > 20 || Math.abs(px[i + 1] - px[i + 2]) > 20)) return true;
  return false;
}

function load(): Promise<Emoji[]> {
  loaded ??= fetch("/emoji-data.json").then((r) => r.json()).then((all: Raw[]) => {
    // Find the newest emoji version this device can draw, testing one simple emoji from each version.
    let max = Infinity;
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.font = "24px sans-serif";
      ctx.textBaseline = "top";
      const versions = [...new Set(all.map((e) => e.version))].sort((a, b) => b - a);
      for (const v of versions) {
        const test = all.find((e) => e.version === v && [...e.emoji.replace(/️/g, "")].length === 1);
        if (test && drawsInColor(ctx, test.emoji)) { max = v; break; }
      }
      // A canvas that draws no color at all (some privacy settings) tells us nothing, so show everything.
      if (max < 5) max = Infinity;
    }
    return all
      .filter((e) => e.group !== 2 && e.version <= max)
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ ...e, words: [e.annotation, ...(e.tags ?? []), ...(e.shortcodes ?? []).map((s) => s.replace(/_/g, " "))].join(" ").toLowerCase() }));
  }).catch((err) => { loaded = null; throw err; });
  return loaded;
}

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const [all, setAll] = useState<Emoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState(0);
  const [tonesOpen, setTonesOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    load().then((e) => !cancelled && setAll(e), () => !cancelled && setFailed(true));
    setTone(Number(read(TONE_KEY)) || 0);
    try { setRecent(JSON.parse(read(RECENT_KEY) ?? "[]").slice(0, 16)); } catch { /* ignore */ }
    // Start typing right away on a computer. On a phone the keyboard would cover the panel.
    if (window.matchMedia("(pointer: fine)").matches) setTimeout(() => search.current?.focus(), 30);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const withTone = (e: Emoji) => (tone && e.skins?.find((s) => s.tone === tone)?.emoji) || e.emoji;
  const byEmoji = useMemo(() => new Map((all ?? []).flatMap((e) => [[e.emoji, e] as const, ...(e.skins ?? []).map((s) => [s.emoji, e] as const)])), [all]);
  const sections = useMemo(() => (all ? GROUPS.map((g) => ({ ...g, items: all.filter((e) => g.groups.includes(e.group)) })) : []), [all]);
  const results = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!all || !words.length) return null;
    return all.filter((e) => words.every((w) => e.words.includes(w))).slice(0, 300);
  }, [all, query]);

  function pick(emoji: string) {
    const next = [emoji, ...recent.filter((r) => r !== emoji)].slice(0, 16);
    setRecent(next);
    write(RECENT_KEY, JSON.stringify(next));
    onPick(emoji);
  }

  function jump(i: number) {
    setQuery("");
    setActive(i);
    requestAnimationFrame(() => {
      const box = list.current, el = box?.querySelector<HTMLElement>(`[data-section="${i}"]`);
      if (box && el) box.scrollTop = el.offsetTop;
    });
  }

  function onScroll() {
    const box = list.current;
    if (!box || results) return;
    let current = 0;
    box.querySelectorAll<HTMLElement>("[data-section]").forEach((el) => { if (el.offsetTop <= box.scrollTop + 8) current = Number(el.dataset.section); });
    setActive(current);
  }

  const button = (shown: string, label: string) => (
    <button key={shown} type="button" className="ep-emoji" title={label} aria-label={label} onClick={() => pick(shown)}>{shown}</button>
  );

  return (
    <div className="emoji-panel" role="dialog" aria-label="Choose an emoji">
      <div className="ep-top">
        <label htmlFor="ep-search" className="sr-only">Search emoji</label>
        <input id="ep-search" ref={search} type="search" className="ep-search" placeholder="Search" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="ep-tone">
          <button type="button" className="ep-emoji" aria-label="Skin tone" aria-expanded={tonesOpen} title="Skin tone" onClick={() => setTonesOpen(!tonesOpen)}>{TONES[tone]}</button>
          {tonesOpen && (
            <div className="ep-tones">
              {TONES.map((t, i) => (
                <button key={t} type="button" className={`ep-emoji${i === tone ? " on" : ""}`} aria-pressed={i === tone} aria-label={i ? `Skin tone ${i}` : "No skin tone"}
                  onClick={() => { setTone(i); write(TONE_KEY, String(i)); setTonesOpen(false); }}>{t}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {!results && (
        <nav className="ep-tabs" aria-label="Emoji categories">
          {GROUPS.map((g, i) => (
            <button key={g.name} type="button" className={i === active ? "on" : undefined} aria-label={g.name} title={g.name} onClick={() => jump(i)}>{g.icon}</button>
          ))}
        </nav>
      )}
      <div className="ep-list" ref={list} onScroll={onScroll}>
        {failed ? <p className="ep-empty">The emoji didn&apos;t load. Close this and try again.</p>
          : !all ? <p className="ep-empty">Loading emoji</p>
          : results ? (
            results.length ? <div className="ep-grid">{results.map((e) => button(withTone(e), e.annotation))}</div> : <p className="ep-empty">No emoji match that.</p>
          ) : (
            <>
              {recent.length > 0 && (
                <section className="ep-section">
                  <h3>Frequently used</h3>
                  <div className="ep-grid">{recent.map((r) => button(r, byEmoji.get(r)?.annotation ?? r))}</div>
                </section>
              )}
              {sections.map((s, i) => (
                <section key={s.name} className="ep-section" data-section={i}>
                  <h3>{s.name}</h3>
                  <div className="ep-grid">{s.items.map((e) => button(withTone(e), e.annotation))}</div>
                </section>
              ))}
            </>
          )}
      </div>
    </div>
  );
}
