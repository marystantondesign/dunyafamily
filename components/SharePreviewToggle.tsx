"use client";
import { useState } from "react";

/** Admin settings: whether a shared photo link shows that photo in its preview. */
export function SharePreviewToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  return (
    <div className="you-switch">
      <label>
        <span>
          <strong>Show photo in shared link previews</strong>
          <span>When someone texts or emails a link to one photo, the preview shows that photo. Nothing else is shown, and opening the link still asks for the family password. Off: every link shows the plain Dunya Family card.</span>
        </span>
        <input type="checkbox" role="switch" className="switch" checked={on}
          onChange={async (e) => {
            const next = e.target.checked;
            setOn(next); setError("");
            const res = await fetch("/api/admin/share-previews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: next }) }).catch(() => null);
            if (!res?.ok) { setOn(!next); setError("That didn't save. Try again."); }
          }} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
