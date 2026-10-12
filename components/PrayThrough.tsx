"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

type Item = { id: number; forName: string | null; about: string; howToPray: string | null; from: string };

const BACK = "/prayer?tab=mine";
const FADE_MS = 400;
// Amen stays about 2.5 seconds (2 with reduced motion), then fades back to My prayers.
const AMEN_MS = 2500, AMEN_STILL_MS = 2000, LEAVE_MS = 500;
// Words that read naturally after "Pray" in lower case ("Pray that he...", "Pray for peace..."). Anything else, like a name, keeps its capital.
const LOWER = new Set(["that", "for", "the", "a", "an", "his", "her", "their", "our", "my", "he", "she", "they", "we", "it", "healing", "peace",
  "strength", "safe", "safety", "comfort", "wisdom", "guidance", "protection", "travel", "traveling", "everything", "all", "good", "smooth",
  "quick", "full", "continued", "patience", "with", "over", "about", "through"]);

/** "That he has a healing recovery" reads as "Pray that he has a healing recovery". Text that already starts with "Pray" stays as it is. */
function prayLine(text: string) {
  const t = text.trim();
  if (/^pray\b/i.test(t)) return t;
  const first = t.split(/\s+/)[0] ?? "";
  return `Pray ${LOWER.has(first.toLowerCase()) ? t.charAt(0).toLowerCase() + t.slice(1) : t}`;
}

/**
 * Pray through these (mockups 44 to 46): full screen and dark, one request at a time at the person's own pace.
 * Next, a tap anywhere, a swipe left, the right arrow, or Space moves on. Nothing is recorded or sent.
 */
export function PrayThrough({ items }: { items: Item[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState<"in" | "out">("in");
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const touch = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const done = index >= items.length;

  useEffect(() => {
    setMounted(true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; window.clearTimeout(timer.current); };
  }, []);

  // A slow fade between requests, or a straight cut with reduced motion.
  const step = useCallback((by: number) => {
    const to = Math.max(0, Math.min(items.length, index + by));
    if (to === index || fade === "out") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setIndex(to); return; }
    setFade("out");
    timer.current = window.setTimeout(() => { setIndex(to); setFade("in"); }, FADE_MS);
  }, [index, items.length, fade]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.push(BACK);
      else if (done) return;
      else if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, done, router]);

  // After the last one: Amen, then back to My prayers on its own. A tap goes back right away.
  const leave = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(BACK), still ? 0 : LEAVE_MS);
  }, [leaving, router]);
  useEffect(() => {
    if (!done) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(leave, still ? AMEN_STILL_MS : AMEN_MS);
    return () => window.clearTimeout(t);
  }, [done, leave]);

  const n = items.length;
  const item = items[Math.min(index, n - 1)];
  const layer = (
    <div className={`pt${leaving ? " leaving" : ""}`} onClick={() => { if (done) leave(); else step(1); }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const startX = touch.current; touch.current = null;
        if (startX === null || done) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (dx < -50) { e.preventDefault(); step(1); }
      }}>
      {done ? (
        <div className="pt-end" role="status">
          <span className="pt-glow" aria-hidden="true">🙏</span>
          <h1>Amen.</h1>
        </div>
      ) : (
        <>
          <div className="pt-top">
            <Link href={BACK} className="pt-x" aria-label="Stop praying through" onClick={(e) => e.stopPropagation()}><Icon name="x" size={24} /></Link>
            <span className="pt-count">{index + 1} of {n}</span>
          </div>
          <div className={`pt-body ${fade}`} aria-live="polite">
            {item.forName && <p className="pt-for">For {item.forName}</p>}
            <h1 className="pt-about">{item.about}</h1>
            {item.howToPray && <p className="pt-how">{prayLine(item.howToPray)}</p>}
            <p className="pt-by">Requested by {item.from}</p>
          </div>
          <div className="pt-bottom">
            <p className="pt-hint">Close your eyes and pray.<br />Tap Next when you&apos;re ready.</p>
            <button type="button" className="pt-next" onClick={(e) => { e.stopPropagation(); step(1); }}>Next</button>
            <span className="pt-dots" aria-hidden="true">{items.map((x, i) => <span key={x.id} className={i === index ? "on" : undefined} />)}</span>
          </div>
        </>
      )}
    </div>
  );
  return mounted ? createPortal(layer, document.body) : null;
}
