import Link from "next/link";
import { whenLabel } from "@/lib/when";
import { Star } from "./Star";
import { QBadge } from "./TaggingNeeded";

type GalleryPhoto = { id: number; url: string; width: number | null; height: number | null; year: number | null; decade: number | null; month: number | null };

/**
 * Justified rows of photos. `query` carries the view's filters to the photo page so previous and next follow them.
 * With `onToggle`, tiles become checkboxes for select mode.
 */
export function Gallery({ photos, base = 220, showWhen = false, query, selected, onToggle, starred, flagged }: {
  photos: GalleryPhoto[]; base?: number; showWhen?: boolean; query?: string;
  /** Your favorites view: a small gold star on every tile. */
  starred?: boolean;
  /** Tagging needed view: a small question-mark badge on every tile. */
  flagged?: boolean;
  selected?: number[]; onToggle?: (id: number) => void;
}) {
  if (!photos.length) return null;
  return (
    <div className={`gallery${onToggle ? " selecting" : ""}`} style={{ "--base": `${base}px` } as React.CSSProperties}>
      {photos.map((p) => {
        const r = p.width && p.height ? p.width / p.height : 1;
        const when = whenLabel(p);
        const inner = (
          <>
            <span className="ratio" style={{ paddingBottom: `${100 / r}%` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={when ? `Family photo from ${when}` : "Family photo"} loading="lazy" />
            {showWhen && when && <span className="when">{when}</span>}
            {starred && !onToggle && <span className={`fav-badge${flagged ? " beside" : ""}`} aria-hidden="true"><Star on size={14} /></span>}
            {flagged && !onToggle && <QBadge size={24} className="tile-q" />}
            {onToggle && <span className="check" aria-hidden="true" />}
          </>
        );
        if (onToggle) {
          const on = !!selected?.includes(p.id);
          return (
            <button key={p.id} type="button" role="checkbox" aria-checked={on} className={on ? "on" : undefined} style={{ "--r": r } as React.CSSProperties} onClick={() => onToggle(p.id)}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={p.id} href={`/photos/${p.id}${query ? `?${query}` : ""}`} style={{ "--r": r } as React.CSSProperties}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
