"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Star } from "./Star";

/**
 * Favorite a photo, for whoever this visit picked. Changes at once, then saves; if saving fails it goes back
 * and says why. A dark pill confirms it, like "Comment posted".
 */
export function useFavorite(photoId: number, initial: boolean) {
  const [on, setOn] = useState(initial);
  const [toast, setToast] = useState<{ text: string; star: boolean; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setOn(initial), [initial, photoId]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (text: string, star: boolean) => {
    clearTimeout(timer.current);
    setToast({ text, star, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2200);
  };
  async function toggle() {
    const next = !on;
    setOn(next);
    show(next ? "Saved to your favorites" : "Removed from your favorites", next);
    try {
      const res = await fetch("/api/favorites", { method: next ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again.");
    } catch (e) {
      setOn(!next);
      show((e as Error).message, false);
    }
  }
  return { on, toggle, toast };
}

export function FavoriteToast({ toast }: { toast: { text: string; star: boolean; key: number } | null }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return createPortal(
    <div className="fav-toast-slot" aria-live="polite">
      {toast && <span key={toast.key} className="fav-toast">{toast.star && <Star on size={15} />}{toast.text}</span>}
    </div>,
    document.body,
  );
}

/** Desktop: "Favorite" with an outlined star, or "Favorited" in soft gold. */
export function FavoriteButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`btn pv-bar-btn fav-btn${on ? " on" : ""}`} aria-pressed={on} aria-label="Favorite" onClick={onToggle}>
      <Star on={on} size={16} /> {on ? "Favorited" : "Favorite"}
    </button>
  );
}

/** Phone top bar: just the star, 44px to tap. */
export function FavoriteIcon({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`icon-btn fav-icon${on ? " on" : ""}`} aria-pressed={on} aria-label="Favorite" onClick={onToggle}>
      <Star on={on} size={24} />
    </button>
  );
}
