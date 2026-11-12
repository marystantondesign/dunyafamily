"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Toast } from "./SelectAlbums";

/** "Album created" once after making an album, then the address drops ?created=1 so a reload doesn't show it again. */
export function CreatedToast() {
  const path = usePathname();
  const [on, setOn] = useState(true);
  useEffect(() => { window.history.replaceState(null, "", path); }, [path]);
  const done = useCallback(() => setOn(false), []);
  return on ? <Toast text="Album created" onDone={done} /> : null;
}
