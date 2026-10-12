"use client";
import { useEffect } from "react";

/** Sends people on to the family password right away. Link preview crawlers don't run this, so they keep the preview. */
export function GoToEnter({ href }: { href: string }) {
  useEffect(() => { window.location.replace(href); }, [href]);
  return null;
}
