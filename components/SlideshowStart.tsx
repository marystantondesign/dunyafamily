"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

const SPEEDS = [3, 5, 10];

/** The Slideshow button and its panel: a popover on desktop, a bottom sheet on phones (mockups 2 and 7). */
export function SlideshowStart({ total, filtered, query }: { total: number; filtered: boolean; query: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [labels, setLabels] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [open]);

  const photos = `${total} ${total === 1 ? "photo" : "photos"}`;
  function start() {
    const qs = new URLSearchParams(query);
    qs.set("speed", String(speed));
    if (!labels) qs.set("labels", "0");
    router.push(`/slideshow?${qs}`);
  }

  return (
    <div className="slideshow-start" ref={box}>
      <button type="button" className="btn btn-primary" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} disabled={!total}>
        <Icon name="play" size={14} /> Slideshow
      </button>
      {open && (
        <>
          <div className="ss-backdrop phone-only" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="ss-panel" role="dialog" aria-labelledby="ss-title">
            <div className="sheet-grip phone-only" aria-hidden="true" />
            <h2 id="ss-title">Start a slideshow</h2>
            <p>{filtered
              ? `Plays the ${photos} that match your filters, in the order shown.`
              : `No filters, so it plays all ${photos} at random. Pick a person, occasion, decade, or album to narrow it.`}</p>
            <span className="label" id="ss-speed">Each photo shows for</span>
            <div className="ss-speeds" role="radiogroup" aria-labelledby="ss-speed">
              {SPEEDS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={speed === s} className={speed === s ? "on" : undefined} onClick={() => setSpeed(s)}>{s} sec</button>
              ))}
            </div>
            <label className="ss-labels">
              <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
              Show names and dates on each photo
            </label>
            <button type="button" className="btn btn-primary ss-go" onClick={start}>Start</button>
          </div>
        </>
      )}
    </div>
  );
}
