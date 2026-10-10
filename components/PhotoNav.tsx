"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Previous and next within the view the person came from. Left and right arrow keys work too. */
export function PhotoNav({ prev, next, pos, total, tagHref }: { prev?: string; next?: string; pos?: number; total?: number; tagHref: string }) {
  const router = useRouter();
  useEffect(() => {
    if (prev) router.prefetch(prev);
    if (next) router.prefetch(next);
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft" && prev) router.push(prev);
      if (e.key === "ArrowRight" && next) router.push(next);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  return (
    <nav className="photo-nav" aria-label="Photos">
      <span className="photo-nav-steps">
        {prev ? <Link href={prev} className="btn">← Previous</Link> : <span className="btn" aria-disabled="true">← Previous</span>}
        {pos && total ? <span className="small muted">{pos} of {total}</span> : null}
        {next ? <Link href={next} className="btn">Next →</Link> : <span className="btn" aria-disabled="true">Next →</span>}
      </span>
      <Link href={tagHref} className="small">Tag in tagging mode</Link>
    </nav>
  );
}
