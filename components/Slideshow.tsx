"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { whenLabel } from "@/lib/when";
import { Icon } from "./Icon";

type Slide = { id: number; title: string | null; occasion: string | null; year: number | null; decade: number | null; month: number | null; people: string[] };
type Link_ = { url: string; at: number };

const SPEEDS = [3, 5, 10];
// Photo links last an hour. Ask for fresh ones well before that.
const FRESH_FOR = 40 * 60 * 1000;
// Each half of the dip to background: the photo fades out, then the next one fades in.
const DIP_MS = 250;
const OVERLAY_MS = 3000;
const HINT_KEY = "df_ss_hint";

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : list.length === 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
const titleOf = (s: Slide) => s.title || [s.occasion, whenLabel(s)].filter(Boolean).join(", ") || "Date unknown";
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Each photo is fully decoded before it's shown, so a change never shows a half-loaded frame.
const decoding = new Map<string, Promise<void>>();
function decoded(url: string) {
  let p = decoding.get(url);
  if (!p) {
    const img = new Image();
    img.src = url;
    // A photo that can't be decoded still moves the show along rather than stopping it.
    p = img.decode().catch(() => undefined);
    decoding.set(url, p);
  }
  return p;
}

/**
 * The slideshow (mockups 5, 40, 41, and 42): its own full-screen layer, playing the view it was started from.
 * Only one photo is ever on screen: it fades to the background, then the next one fades in once it's ready.
 * Space pauses, the arrow keys step, Esc exits. On phones, tapping the photo hides the controls (upright) or
 * shows them over the photo for a few seconds (sideways), and swiping steps.
 */
export function Slideshow({ slides, start, chips, exitHref, initialSpeed, labels, initialLinks }: {
  slides: Slide[]; start: number; chips: string[]; exitHref: string; initialSpeed: number; labels: boolean;
  initialLinks: Record<number, string>;
}) {
  const router = useRouter();
  const total = slides.length;
  const wrap = useCallback((i: number) => ((i % total) + total) % total, [total]);
  const at = (i: number) => slides[wrap(i)];

  // target is where the show is going; shown is the photo on screen. They differ while the next one loads and fades.
  const [target, setTarget] = useState(start);
  const [shown, setShown] = useState(start);
  const [fade, setFade] = useState<"in" | "out">("in");
  const [loaded, setLoaded] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(SPEEDS.includes(initialSpeed) ? initialSpeed : 5);
  const [hidden, setHidden] = useState(false);
  const [sideways, setSideways] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [poke, setPoke] = useState(0);
  const [hint, setHint] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [links, setLinks] = useState<Record<number, Link_>>(() => {
    const now = Date.now();
    return Object.fromEntries(Object.entries(initialLinks).map(([id, url]) => [id, { url, at: now }]));
  });
  const elapsed = useRef(0);
  const startedAt = useRef(0);
  const touch = useRef<number | null>(null);
  const swiped = useRef(false);
  const asking = useRef(new Set<number>());

  const current = at(shown);
  const go = useCallback((step: number) => setTarget((t) => wrap(t + step)), [wrap]);

  // Its own layer over everything: the page behind doesn't scroll, and no page layout can shift it off center.
  useEffect(() => {
    setMounted(true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, []);

  // Phone held sideways: the photo fills the screen and the controls only show when tapped.
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 520px)");
    const set = () => { setSideways(mq.matches); setOverlay(false); };
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // The first slideshow on a phone gets a short tip that fades on its own.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 760px), (max-height: 520px)").matches) return;
    try { if (localStorage.getItem(HINT_KEY)) return; localStorage.setItem(HINT_KEY, "1"); } catch { return; }
    setHint(true);
    const t = setTimeout(() => setHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  // Sideways controls hide again after a few seconds without a tap.
  useEffect(() => {
    if (!overlay) return;
    const t = setTimeout(() => setOverlay(false), OVERLAY_MS);
    return () => clearTimeout(t);
  }, [overlay, poke]);

  // Links for the photo it's heading to and the next two, fetched before they're needed and again before they expire.
  useEffect(() => {
    const want = [0, 1, 2].map((k) => at(target + k).id)
      .filter((id) => (!links[id] || Date.now() - links[id].at > FRESH_FOR) && !asking.current.has(id));
    if (!want.length) return;
    want.forEach((id) => asking.current.add(id));
    fetch(`/api/slideshow?ids=${want.join(",")}`).then((r) => r.json()).then((out: { urls: Record<string, string>; at: number }) => {
      setLinks((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(out.urls).map(([id, url]) => [id, { url, at: Date.now() }])) }));
    }).catch(() => undefined).finally(() => want.forEach((id) => asking.current.delete(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, links]);

  // Decode the next photo while this one shows, so it's ready when the timer ends.
  useEffect(() => {
    const next = links[at(shown + 1).id];
    if (next) decoded(next.url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, links]);

  // Changing photos: wait until the next one is decoded (holding on this one meanwhile), fade this one out to the
  // background, swap, and fade the new one in. With reduced motion it cuts straight across.
  useEffect(() => {
    if (target === shown) return;
    const url = links[at(target).id]?.url;
    if (!url) return;
    let cancelled = false;
    let t: number | undefined;
    decoded(url).then(() => {
      if (cancelled) return;
      if (reducedMotion()) { setShown(target); setFade("in"); return; }
      setFade("out");
      t = window.setTimeout(() => { if (!cancelled) { setShown(target); setFade("in"); } }, DIP_MS);
    });
    return () => { cancelled = true; window.clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, shown, links]);

  // A photo can finish loading before this code is running (the first one, or one from the cache), so check directly too.
  useEffect(() => {
    const img = document.querySelector<HTMLImageElement>(".ssv-stage img");
    if (img?.complete && img.naturalWidth) setLoaded(current.id);
  }, [current.id, links, mounted]);

  // The timer only runs while playing, once the photo is on screen. Pausing keeps the time already shown.
  const ready = loaded === current.id && fade === "in" && target === shown;
  const lastKey = useRef("");
  useEffect(() => {
    // A new photo or a new speed starts the count again.
    const key = `${shown}-${speed}`;
    if (key !== lastKey.current) { lastKey.current = key; elapsed.current = 0; }
    if (!playing || !ready || total < 2) return;
    startedAt.current = Date.now();
    const t = window.setTimeout(() => go(1), Math.max(0, speed * 1000 - elapsed.current));
    return () => { window.clearTimeout(t); elapsed.current += Date.now() - startedAt.current; };
  }, [playing, ready, speed, shown, go, total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape" && !document.fullscreenElement) router.push(exitHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, router, exitHref]);

  function fullScreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else document.documentElement.requestFullscreen().catch(() => undefined);
  }

  function tap() {
    if (swiped.current) { swiped.current = false; return; }
    if (sideways) { setOverlay((o) => !o); setPoke((n) => n + 1); }
    else setHidden((h) => !h);
  }

  const progress = (className: string) => (
    <div className={className} aria-hidden="true">
      <span key={`${shown}-${speed}-${ready}`} className={ready ? "run" : undefined}
        style={{ animationDuration: `${speed}s`, animationPlayState: playing ? "running" : "paused" }} />
    </div>
  );

  const link = links[current.id];
  const layer = (
    <div className={`ssv${hidden ? " hide-controls" : ""}${sideways ? " sideways" : ""}${overlay ? " overlay" : ""}`}
      onPointerDown={() => { if (overlay) setPoke((n) => n + 1); }}>
      <div className="ssv-top">
        <span className="ssv-chips">
          <span className="desktop-only ssv-word">Slideshow</span>
          {chips.map((c) => <span key={c} className="ssv-chip">{c}</span>)}
        </span>
        <Link href={exitHref} className="ssv-exit desktop-only">Exit <kbd>Esc</kbd></Link>
        <Link href={exitHref} className="ssv-x phone-only" aria-label="Exit slideshow"><Icon name="x" size={22} /></Link>
      </div>

      <div className="ssv-stage" onClick={tap}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const startX = touch.current; touch.current = null;
          if (startX === null) return;
          const dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 50) { swiped.current = true; go(dx < 0 ? 1 : -1); }
        }}>
        {link && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={link.url} alt={titleOf(current)} className={fade} onLoad={() => setLoaded(current.id)} />
        )}
      </div>

      <div className="ssv-bottom">
        {progress("ssv-progress")}
        <div className="ssv-row">
          <div className="ssv-label" aria-live="polite">
            {labels && (
              <>
                <p className="ssv-title">{titleOf(current)}</p>
                {current.people.length > 0 && <p className="ssv-people">{names(current.people)}</p>}
              </>
            )}
          </div>
          <div className="ssv-controls">
            <button type="button" className="ssv-btn" aria-label="Previous photo" onClick={() => go(-1)}><Icon name="chevronLeft" size={20} /></button>
            <button type="button" className="ssv-btn ssv-play" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
              <Icon name={playing ? "pause" : "play"} size={20} />
            </button>
            <button type="button" className="ssv-btn" aria-label="Next photo" onClick={() => go(1)}><Icon name="chevronRight" size={20} /></button>
          </div>
          <div className="ssv-extra desktop-only">
            <button type="button" className="ssv-box" aria-label={`Each photo shows for ${speed} seconds. Change speed.`}
              onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>{speed} sec</button>
            <button type="button" className="ssv-box" aria-label="Full screen" onClick={fullScreen}><Icon name="expand" size={18} /></button>
          </div>
        </div>
      </div>

      {sideways && !overlay && progress("ssv-edge")}
      {hint && <p className="ssv-hint" role="status">{sideways ? "Tap the photo to show controls." : "Tap the photo to hide controls. Turn your phone sideways for a bigger view."}</p>}
    </div>
  );

  return mounted ? createPortal(layer, document.body) : null;
}
