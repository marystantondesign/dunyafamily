import Link from "next/link";
import { whenLabel, type Photo } from "@/lib/photos";

export function Gallery({ photos, base = 220, showWhen = false }: { photos: Photo[]; base?: number; showWhen?: boolean }) {
  if (!photos.length) return null;
  return (
    <div className="gallery" style={{ "--base": `${base}px` } as React.CSSProperties}>
      {photos.map((p) => {
        const r = p.width && p.height ? p.width / p.height : 1;
        const when = whenLabel(p);
        return (
          <Link key={p.id} href={`/photos/${p.id}`} style={{ "--r": r } as React.CSSProperties}>
            <span className="ratio" style={{ paddingBottom: `${100 / r}%` }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={when ? `Family photo from ${when}` : "Family photo"} loading="lazy" />
            {showWhen && when && <span className="when">{when}</span>}
          </Link>
        );
      })}
    </div>
  );
}
