"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { whenLabel } from "@/lib/when";
import { Icon } from "./Icon";

type Slide = { id: number; title: string | null; occasion: string | null; year: number | null; decade: number | null; month: number | null; people: string[] };
type Link_ = { url: string; at: number };


const SPEEDS = [3, 5, 10];
// Photo links last an hour. Ask for fresh ones well before that.
const FRESH_FOR = 40 * 60 * 1000;

const names = (list: string[]) =>
  list.length <= 1 ? list.join("") : list.length === 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
const titleOf = (s: Slide) => s.title || [s.occasion, whenLabel(s)].filter(Boolean).join(", ") || "Date unknown";

/**
 * The slideshow (mockups 5 and 10): full screen and dark, playing the view it was started from.
 * Space pauses, the arrow keys step, Esc exits. On phones, tapping the photo hides the controls.
 */
export function Slideshow({ slides, start, chips, exitHref, initialSpeed, labels, initialLinks }: {
  slides: Slide[]; start: number; chips: string[]; exitHref: string; initialSpeed: number; labels: boolean;
  initialLinks: Record<number, string>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(start);
  const [prev, setPrev] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(SPEEDS.includes(initialSpeed) ? initialSpeed : 5);
  const [hidden, setHidden] = useState(false);
  const [loaded, setLoaded] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<number, Link_>>(() => {
    const now = Date.now();
    return Object.fromEntries(Object.entries(initialLinks).map(([id, url]) => [id, { url, at: now }]));
  });
  const elapsed = useRef(0);
  const startedAt = useRef(0);
  const touch = useRef<number | null>(null);
  const asking = useRef(new Set<number>());

  const total = slides.length;
  const at = (i: number) => slides[((i % total) + total) % total];
  const current = at(index);

  const go = useCallback((step: number) => {
    setPrev(index);
    setIndex((i) => (((i + step) % total) + total) % total);
  }, [index, total]);

  // Links for this photo and the next two, fetched before they're needed and again before they expire.
  useEffect(() => {
    const want = [0, 1, 2].map((k) => at(index + k).id)
      .filter((id) => (!links[id] || Date.now() - links[id].at > FRESH_FOR) && !asking.current.has(id));
    if (!want.length) return;
    want.forEach((id) => asking.current.add(id));
    fetch(`/api/slideshow?ids=${want.join(",")}`).then((r) => r.json()).then((out: { urls: Record<string, string>; at: number }) => {
      setLinks((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(out.urls).map(([id, url]) => [id, { url, at: Date.now() }])) }));
    }).catch(() => undefined).finally(() => want.forEach((id) => asking.current.delete(id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, links]);

  // Preload the next photo so it's ready when its turn comes.
  useEffect(() => {
    const next = links[at(index + 1).id];
    if (next) { const img = new Image(); img.src = next.url; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, links]);

  // A photo can finish loading before this code is running (the first one, or one from the cache), so check directly too.
  useEffect(() => {
    const img = document.querySelector<HTMLImageElement>(".ssv-stage img.in");
    if (img?.complete && img.naturalWidth) setLoaded(current.id);
  }, [current.id, links]);

  // The timer only runs while playing and once the photo has loaded. Pausing keeps the time already shown.
  const ready = loaded === current.id;
  const lastKey = useRef("");
  useEffect(() => {
    // A new photo or a new speed starts the count again.
    const key = `${index}-${speed}`;
    if (key !== lastKey.current) { lastKey.current = key; elapsed.current = 0; }
    if (!playing || !ready || total < 2) return;
    startedAt.current = Date.now();
    const t = window.setTimeout(() => go(1), Math.max(0, speed * 1000 - elapsed.current));
    return () => { window.clearTimeout(t); elapsed.current += Date.now() - startedAt.current; };
  }, [playing, ready, speed, index, go, total]);

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

  const shown = [prev !== null && prev !== index ? at(prev) : null, current].filter(Boolean) as Slide[];
  return (
    <div className={`ssv${hidden ? " hide-controls" : ""}`}>
      <div className="ssv-top">
        <span className="ssv-chips">
          <span className="desktop-only ssv-word">Slideshow</span>
          {chips.map((c) => <span key={c} className="ssv-chip">{c}</span>)}
        </span>
        <Link href={exitHref} className="ssv-exit desktop-only">Exit <kbd>Esc</kbd></Link>
        <Link href={exitHref} className="ssv-x phone-only" aria-label="Exit slideshow"><Icon name="x" size={26} /></Link>
      </div>

      <div className="ssv-stage" onClick={() => setHidden((h) => !h)}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const startX = touch.current; touch.current = null;
          if (startX === null) return;
          const dx = e.changedTouches[0].clientX - startX;
          if (Math.abs(dx) > 50) { e.preventDefault(); go(dx < 0 ? 1 : -1); }
        }}>
        {shown.map((s) => links[s.id] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={s.id} src={links[s.id].url} alt={titleOf(s)} className={s.id === current.id ? "in" : "out"}
            onLoad={() => { if (s.id === current.id) setLoaded(s.id); }}
            onAnimationEnd={() => { if (s.id === current.id) setPrev(null); }} />
        ))}
      </div>

      <div className="ssv-bottom">
        <div className="ssv-progress" aria-hidden="true">
          <span key={`${index}-${speed}-${ready}`} className={ready ? "run" : undefined}
            style={{ animationDuration: `${speed}s`, animationPlayState: playing ? "running" : "paused" }} />
        </div>
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
            <button type="button" className="ssv-btn" aria-label="Previous photo" onClick={() => go(-1)}><Icon name="chevronLeft" size={22} /></button>
            <button type="button" className="ssv-btn ssv-play" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)}>
              <Icon name={playing ? "pause" : "play"} size={22} />
            </button>
            <button type="button" className="ssv-btn" aria-label="Next photo" onClick={() => go(1)}><Icon name="chevronRight" size={22} /></button>
          </div>
          <div className="ssv-extra desktop-only">
            <button type="button" className="ssv-box" aria-label={`Each photo shows for ${speed} seconds. Change speed.`}
              onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>{speed} sec</button>
            <button type="button" className="ssv-box" aria-label="Full screen" onClick={fullScreen}><Icon name="expand" size={18} /></button>
          </div>
        </div>
        <p className="ssv-hint phone-only">Tap the photo to hide controls. Turn your phone sideways for a bigger view.</p>
      </div>
    </div>
  );
}
