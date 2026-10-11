import Link from "next/link";

/** The same card as the automatic albums on Home: title, a line under it, and three photos. */
export function AlbumCard({ href, title, text, photos }: { href: string; title: string; text: string; photos: { id: number; url: string }[] }) {
  return (
    <Link href={href} className="album-card">
      <span>
        <span className="album-title">{title}</span>
        <span className="album-text">{text}</span>
      </span>
      <span className="album-photos">
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={p.url} alt="" loading="lazy" />
        ))}
        {Array.from({ length: Math.max(0, 3 - photos.length) }, (_, i) => <span key={i} className="album-blank" />)}
      </span>
    </Link>
  );
}
