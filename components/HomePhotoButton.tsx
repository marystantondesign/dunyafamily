"use client";
import { useState } from "react";

/** Admin only: put this photo in the polaroid at the top of Home. */
export function HomePhotoButton({ photoId }: { photoId: number }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <button
      type="button"
      className="link-btn"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        const res = await fetch("/api/settings/home-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photoId }) });
        setState(res.ok ? "done" : "error");
      }}
    >
      {state === "done" ? "On the homepage now" : state === "error" ? "That didn't work. Try again." : "Use as homepage photo"}
    </button>
  );
}
