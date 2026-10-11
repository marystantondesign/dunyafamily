"use client";
import { useEffect, useRef } from "react";

/**
 * The full emoji panel (search, categories, skin tones, recently used), like the one on a Mac or iPhone.
 * It's the emoji-picker-element web component, drawn with the device's own emoji. Its emoji list is served
 * from this site (public/emoji-data.json, copied from emoji-picker-element-data).
 */
export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let picker: HTMLElement | null = null;
    let cancelled = false;
    const pick = (e: Event) => { const u = (e as CustomEvent<{ unicode?: string }>).detail?.unicode; if (u) onPick(u); };
    import("emoji-picker-element").then(({ Picker }) => {
      // The panel may have closed while the picker code was loading.
      if (cancelled || !box.current) return;
      picker = new Picker({ dataSource: "/emoji-data.json", locale: "en" }) as unknown as HTMLElement;
      picker.addEventListener("emoji-click", pick);
      box.current.appendChild(picker);
      // Start typing right away, like the Mac picker.
      setTimeout(() => (picker?.shadowRoot?.querySelector("input") as HTMLInputElement | null)?.focus(), 50);
    });
    return () => { cancelled = true; picker?.removeEventListener("emoji-click", pick); picker?.remove(); };
  }, [onPick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return <div className="emoji-panel" ref={box} role="dialog" aria-label="Choose an emoji" />;
}
