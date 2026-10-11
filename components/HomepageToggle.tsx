"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Admin only, in a photo's edit panel: put this photo on the homepage Polaroid, with its caption. Same list as Homepage photos. */
export function HomepageToggle({ photoId, entry, used, max }: { photoId: number; entry: { caption: string } | null; used: number; max: number }) {
  const router = useRouter();
  const [on, setOn] = useState(!!entry);
  const [caption, setCaption] = useState(entry?.caption ?? "");
  const [savedCaption, setSavedCaption] = useState(entry?.caption ?? "");
  const [error, setError] = useState("");
  const full = !on && used >= max;

  async function send(body: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/admin/homepage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "That didn't save. Try again."); return false; }
    router.refresh();
    return true;
  }

  return (
    <div className="meta-block homepage-toggle">
      <label className="switch-row">
        <input type="checkbox" role="switch" className="switch" checked={on} disabled={full}
          onChange={async (e) => {
            const next = e.target.checked;
            setOn(next);
            const ok = await send(next ? { action: "add", photoIds: [photoId], caption } : { action: "remove", photoId });
            if (!ok) setOn(!next);
          }} />
        Show on the homepage
      </label>
      <p className="hint">{used} of {max} spots used{full ? ". Remove one from Homepage photos to add this one." : ""}</p>
      {on && (
        <div className="field">
          <label htmlFor="polaroid-caption">Polaroid caption</label>
          <input id="polaroid-caption" className="hand-input" maxLength={60} placeholder="Write a caption" value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => { if (caption !== savedCaption) { setSavedCaption(caption); send({ action: "caption", photoId, caption }); } }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
