"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = { id: number; url: string; caption: string | null };

/**
 * The Polaroid on Home: moves through the chosen photos every few seconds, on phones and desktop alike, each with
 * its handwritten caption. Normally it crossfades; with Reduce Motion on (common on iPhones) it still moves on, just
 * without the fade (see globals.css).
 */
export function HeroPolaroid({ slides, seconds }: { slides: Slide[]; seconds: number }) {
  const [at, setAt] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => setAt((i) => (i + 1) % slides.length), Math.max(2, seconds) * 1000);
    return () => window.clearInterval(t);
  }, [slides.length, seconds]);

  const current = slides[at];
  return (
    <div className="polaroid-wrap">
      <figure className="polaroid">
        <div className="polaroid-photo">
          {slides.length ? slides.map((s, i) => (
            <Link key={s.id} href={`/photos/${s.id}`} className={`polaroid-slide${i === at ? " on" : ""}`} tabIndex={i === at ? 0 : -1} aria-hidden={i !== at} aria-label="Open this photo">
              {/* The photo showing and the next one load right away, so each turn has its photo ready. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.caption ?? ""} loading={i === at || i === (at + 1) % slides.length ? "eager" : "lazy"} />
            </Link>
          )) : <div className="polaroid-blank" />}
        </div>
        <figcaption aria-live="off">{current?.caption ?? ""}</figcaption>
      </figure>
      {slides.length > 1 && (
        <div className="polaroid-dots" aria-hidden="true">
          {slides.map((s, i) => <span key={s.id} className={i === at ? "on" : undefined} />)}
        </div>
      )}
    </div>
  );
}
