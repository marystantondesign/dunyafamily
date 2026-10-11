import Link from "next/link";

/** An album card: a three-photo collage (one large, two stacked), the title, and how many photos. */
export function AlbumCard({ href, title, count, photos }: { href: string; title: string; count: number; photos: { id: number; url: string }[] }) {
  const slots = [0, 1, 2].map((i) => photos[i]);
  return (
    <Link href={href} className="album-card">
      <span className="album-collage" aria-hidden="true">
        {slots.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          p ? <img key={p.id} src={p.url} alt="" loading="lazy" className={i === 0 ? "big" : undefined} /> : <span key={`blank${i}`} className={`album-blank${i === 0 ? " big" : ""}`} />
        ))}
      </span>
      <span className="album-title">{title}</span>
      <span className="album-count">{count} {count === 1 ? "photo" : "photos"}</span>
    </Link>
  );
}
