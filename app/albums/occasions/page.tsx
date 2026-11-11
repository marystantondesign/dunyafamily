import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { Icon } from "@/components/Icon";
import { autoAlbums } from "@/lib/albums";

export const dynamic = "force-dynamic";

/** Every occasion album, made from tags. */
export default async function OccasionsAlbums() {
  const list = (await autoAlbums()).occasions;
  return (
    <div className="albums-page">
      <Link href="/albums" className="back-link"><Icon name="chevronLeft" size={18} /> All albums</Link>
      <h1 className="display">Occasions</h1>
      <div className="album-grid">
        {list.map((a) => <AlbumCard key={a.key} href={a.href} title={a.title} count={a.count} photos={a.photos} />)}
      </div>
    </div>
  );
}
