"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = { id: number; url: string; caption: string | null };

/**
 * The Polaroid on Home: crossfades through the chosen photos every few seconds, each with its handwritten caption.
 * With reduced motion it stays on the first photo.
 */
export function HeroPolaroid({ slides, seconds }: { slides: Slide[]; seconds: number }) {
  const [at, setAt] = useState(0);
  const [still, setStill] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setStill(mq.matches); if (mq.matches) setAt(0); };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (still || slides.length < 2) return;
    const t = window.setInterval(() => setAt((i) => (i + 1) % slides.length), seconds * 1000);
    return () => window.clearInterval(t);
  }, [still, slides.length, seconds]);

  const current = slides[at];
  return (
    <div className="polaroid-wrap">
      <figure className="polaroid">
        <div className="polaroid-photo">
          {slides.length ? slides.map((s, i) => (
            <Link key={s.id} href={`/photos/${s.id}`} className={`polaroid-slide${i === at ? " on" : ""}`} tabIndex={i === at ? 0 : -1} aria-hidden={i !== at} aria-label="Open this photo">
              {/* The first photo loads right away; the rest wait their turn. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.caption ?? ""} loading={i === 0 ? "eager" : "lazy"} />
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
