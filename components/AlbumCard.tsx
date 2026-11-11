import Link from "next/link";

type Creator = { name: string; first: string; avatarUrl: string | null };

/**
 * An album card: an even 2x2 cover of four photos (fewer than four: the first photo fills the square), the title,
 * how many photos, and for albums someone made, their profile photo at the end of that line ("Made by Lucy" on hover).
 */
export function AlbumCard({ href, title, count, photos, creator, className = "" }: {
  href: string; title: string; count: number; photos: { id: number; url: string }[]; creator?: Creator | null; className?: string;
}) {
  const four = photos.length >= 4;
  return (
    <Link href={href} className={`album-card${className ? ` ${className}` : ""}`}>
      <span className={`album-quad${four ? "" : " one"}`} aria-hidden="true">
        {four
          // eslint-disable-next-line @next/next/no-img-element
          ? photos.slice(0, 4).map((p) => <img key={p.id} src={p.url} alt="" loading="lazy" />)
          // eslint-disable-next-line @next/next/no-img-element
          : photos[0] ? <img src={photos[0].url} alt="" loading="lazy" /> : <span className="album-blank" />}
      </span>
      <span className="album-title">{title}</span>
      <span className="album-meta">
        <span className="album-count">{count} {count === 1 ? "photo" : "photos"}</span>
        {creator && (
          <span className="album-maker" role="img" aria-label={`Made by ${creator.name}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {creator.avatarUrl ? <img src={creator.avatarUrl} alt="" /> : creator.first.charAt(0)}
            <span className="album-tip" aria-hidden="true">Made by {creator.first}</span>
          </span>
        )}
      </span>
    </Link>
  );
}
