"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ingredientsIn, shortLine } from "@/lib/cookMatch";
import type { Ingredient } from "@/lib/recipes";
import { Icon } from "./Icon";

type Lock = { release: () => Promise<void>; addEventListener?: (t: string, f: () => void) => void };

/** Keep the screen on while cooking. Asked again whenever the page comes back into view. False when the browser can't. */
function useWakeLock() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    if (!wl) { setSupported(false); return; }
    let lock: Lock | null = null;
    let gone = false;
    const ask = async () => {
      if (document.visibilityState !== "visible" || gone) return;
      try { lock = await wl.request("screen"); } catch { /* low battery or not allowed; nothing to do */ }
    };
    const onVis = () => { if (document.visibilityState === "visible") ask(); };
    ask();
    document.addEventListener("visibilitychange", onVis);
    return () => { gone = true; document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => undefined); };
  }, []);
  return supported;
}

/** Cooking mode: one step at a time, big type, screen stays on. */
export function CookMode({ id, title, steps, ingredients }: { id: number; title: string; steps: string[]; ingredients: Ingredient[] }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const awake = useWakeLock();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const last = i === steps.length - 1;
  const next = () => (last ? router.push(`/recipes/${id}`) : setI((n) => Math.min(steps.length - 1, n + 1)));
  const back = () => setI((n) => Math.max(0, n - 1));
  const need = !last ? ingredientsIn(steps[i + 1], ingredients) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); if (!last) setI((n) => n + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setI((n) => Math.max(0, n - 1)); }
      else if (e.key === "Escape") router.push(`/recipes/${id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, id, router]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={`Cooking ${title}`}
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) { if (!last) setI((n) => n + 1); } else back(); }
      }}>
      <div className="cook-col">
        <div className="cook-top">
          <span className="cook-title">{title}</span>
          <Link href={`/recipes/${id}`} className="icon-btn" aria-label="Stop cooking"><Icon name="x" size={22} /></Link>
        </div>
        <div className="cook-progress" aria-hidden="true">
          {steps.map((_, k) => <span key={k} className={k <= i ? "on" : ""} />)}
        </div>
        <div className="cook-main">
          <span className="cook-count" aria-live="polite">Step {i + 1} of {steps.length}</span>
          <p className="cook-step" key={i}>{steps[i]}</p>
          {need.length > 0 && (
            <div className="cook-need">
              <div className="cook-need-label">You&apos;ll need next</div>
              <div>{need.map(shortLine).join(", ")}</div>
            </div>
          )}
          {awake && (
            <div className={`cook-awake${need.length ? "" : " alone"}`}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              Your screen will stay on while you cook
            </div>
          )}
        </div>
        <div className="cook-bar">
          <button type="button" className="btn" disabled={i === 0} onClick={back}>Back</button>
          <button type="button" className="btn btn-primary" onClick={next}>{last ? "Done" : "Next step"}</button>
        </div>
      </div>
    </div>
  );
}
