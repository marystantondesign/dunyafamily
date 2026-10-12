"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * The reaction picker for photos and comments (mockup 33): a search field, sixteen family favorites, then every
 * emoji below them by category, drawn with the device's own emoji. It opens on whichever side of its button has
 * room, stays inside its area (the comments panel, or the photo stage), and closes on Esc or a click outside,
 * handing focus back to the button. On phones it's a sheet from the bottom.
 */
type Raw = { emoji: string; annotation: string; tags?: string[]; shortcodes?: string[]; group: number; order: number; version: number; skins?: { emoji: string; tone: number | number[] }[] };
type Emoji = Raw & { words: string };

export const FAVORITES = ["😍", "😂", "🥰", "😭", "🙏", "❤️", "👏", "🔥", "🥹", "😮", "🐪", "🌸", "🎉", "💯", "😊", "🤍"];
const GROUPS: { name: string; groups: number[] }[] = [
  { name: "Smileys and people", groups: [0, 1] },
  { name: "Animals and nature", groups: [3] },
  { name: "Food and drink", groups: [4] },
  { name: "Activities", groups: [6] },
  { name: "Travel and places", groups: [5] },
  { name: "Objects", groups: [7] },
  { name: "Symbols", groups: [8] },
  { name: "Flags", groups: [9] },
];
const TONES = ["✋", "✋🏻", "✋🏼", "✋🏽", "✋🏾", "✋🏿"];
const TONE_KEY = "df_emoji_tone";
const WIDTH = 340;
const GAP = 6;

let loaded: Promise<Emoji[]> | null = null;

/** Does this device draw the emoji in color? One it doesn't know comes out as a plain box. */
function drawsInColor(ctx: CanvasRenderingContext2D, emoji: string) {
  ctx.clearRect(0, 0, 32, 32);
  ctx.fillText(emoji, 0, 0);
  const px = ctx.getImageData(0, 0, 32, 32).data;
  for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0 && (Math.abs(px[i] - px[i + 1]) > 20 || Math.abs(px[i + 1] - px[i + 2]) > 20)) return true;
  return false;
}

/** Every emoji (public/emoji-data.json, from emoji-picker-element-data), minus ones too new for this device. */
function loadEmoji(): Promise<Emoji[]> {
  loaded ??= fetch("/emoji-data.json").then((r) => r.json()).then((all: Raw[]) => {
    let max = Infinity;
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.font = "24px sans-serif";
      ctx.textBaseline = "top";
      for (const v of [...new Set(all.map((e) => e.version))].sort((a, b) => b - a)) {
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

export function ReactionPicker({ anchor, within, mine = [], onPick, onClose }: {
  anchor: HTMLElement; within?: HTMLElement | null; mine?: string[]; onPick: (emoji: string) => void; onClose: () => void;
}) {
  const [all, setAll] = useState<Emoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState(0);
  const [tonesOpen, setTonesOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadEmoji().then((e) => !cancelled && setAll(e), () => !cancelled && setFailed(true));
    setTone(Number(read(TONE_KEY)) || 0);
    if (window.matchMedia("(pointer: fine)").matches) setTimeout(() => search.current?.focus(), 20);
    return () => { cancelled = true; };
  }, []);

  // Place it beside the button: below if there's room (or more room than above), and never past the edges of its area.
  useLayoutEffect(() => {
    function place() {
      const small = window.innerWidth <= 760;
      setPhone(small);
      if (small) return setPos(null);
      const a = anchor.getBoundingClientRect();
      const area = within?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight };
      const top = Math.max(area.top, 0), bottom = Math.min(area.bottom, window.innerHeight);
      const below = bottom - a.bottom - GAP - 8, above = a.top - top - GAP - 8;
      const want = 380;
      const left = Math.max(Math.max(area.left, 0) + 8, Math.min(a.left, Math.min(area.right, window.innerWidth) - WIDTH - 8));
      if (below >= Math.min(want, 200) || below >= above) setPos({ left, top: a.bottom + GAP, maxHeight: Math.min(want, below) });
      else setPos({ left, bottom: window.innerHeight - a.top + GAP, maxHeight: Math.min(want, above) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchor, within]);

  useEffect(() => {
    const close = () => { onClose(); anchor.focus(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !anchor.contains(t)) onClose(); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("pointerdown", onDown); };
  }, [anchor, onClose]);

  const withTone = (e: Emoji) => (tone && e.skins?.find((s) => s.tone === tone)?.emoji) || e.emoji;
  const sections = useMemo(() => (all ? GROUPS.map((g) => ({ ...g, items: all.filter((e) => g.groups.includes(e.group)) })) : []), [all]);
  const results = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!all || !words.length) return null;
    return all.filter((e) => words.every((w) => e.words.includes(w))).slice(0, 300);
  }, [all, query]);
  const label = useMemo(() => new Map((all ?? []).map((e) => [e.emoji, e.annotation])), [all]);

  const pick = (emoji: string) => { onPick(emoji); onClose(); anchor.focus(); };
  const button = (emoji: string, name: string) => (
    <button key={emoji} type="button" className={`ep-emoji${mine.includes(emoji) ? " on" : ""}`} title={name} aria-label={name} aria-pressed={mine.includes(emoji)} onClick={() => pick(emoji)}>{emoji}</button>
  );

  const panel = (
    <div ref={box} className={`rp${phone ? " rp-sheet" : ""}`} role="dialog" aria-label="Choose a reaction"
      style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight } : undefined}>
      {phone && <div className="sheet-grip" aria-hidden="true" />}
      <div className="rp-top">
        <label htmlFor="rp-search" className="sr-only">Search emoji</label>
        <input id="rp-search" ref={search} type="search" className="ep-search" placeholder="Search emoji" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
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
      <div className="rp-list">
        {results ? (
          !all ? null : results.length ? <div className="ep-grid rp-grid">{results.map((e) => button(withTone(e), e.annotation))}</div> : <p className="ep-empty">No emoji match that.</p>
        ) : (
          <>
            <section className="ep-section rp-favorites">
              <h3>Family favorites</h3>
              <div className="ep-grid rp-grid">{FAVORITES.map((e) => button(e, label.get(e) ?? e))}</div>
            </section>
            {failed ? <p className="ep-empty">The rest of the emoji didn&apos;t load.</p> : sections.map((s) => (
              <section key={s.name} className="ep-section">
                <h3>{s.name}</h3>
                <div className="ep-grid rp-grid">{s.items.map((e) => button(withTone(e), e.annotation))}</div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(
    <>
      {phone && <div className="rp-backdrop" onClick={onClose} aria-hidden="true" />}
      {(phone || pos) && panel}
    </>,
    document.body,
  );
}
