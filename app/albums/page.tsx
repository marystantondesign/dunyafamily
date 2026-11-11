import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { NewAlbum } from "@/components/NewAlbum";
import { autoAlbums, listAlbums, type AlbumSummary, type AutoAlbum } from "@/lib/albums";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Albums: yours, then ones family made, then the automatic ones by occasion and by decade. Empty sections hide. */
export default async function AlbumsPage() {
  const s = await getSession();
  const [albums, auto] = await Promise.all([listAlbums(s), autoAlbums()]);
  const mine = albums.filter((a) => a.mine), family = albums.filter((a) => !a.mine);
  const grid = (list: AlbumSummary[]) => (
    <div className="album-grid">
      {list.map((a) => <AlbumCard key={a.id} href={`/albums/${a.id}`} title={a.title} count={a.count} photos={a.photos} creator={a.creator} />)}
    </div>
  );
  const row = (list: AutoAlbum[]) => (
    <div className="album-row">
      {list.map((a) => <AlbumCard key={a.key} href={a.href} title={a.title} count={a.count} photos={a.photos} />)}
    </div>
  );
  return (
    <div className="albums-page">
      <div className="albums-head">
        <h1 className="display">Albums</h1>
        <NewAlbum />
      </div>
      {mine.length > 0 && <section><h2 className="albums-h">Your albums</h2>{grid(mine)}</section>}
      {family.length > 0 && <section><h2 className="albums-h">Made by family</h2>{grid(family)}</section>}
      {auto.occasions.length > 0 && (
        <section>
          <div className="albums-sh"><h2 className="albums-h">Occasions</h2><Link href="/albums/occasions">See all {auto.occasions.length}</Link></div>
          {row(auto.occasions)}
        </section>
      )}
      {auto.decades.length > 0 && (
        <section>
          <div className="albums-sh"><h2 className="albums-h">Decades</h2><Link href="/albums/decades">See all {auto.decades.length}</Link></div>
          {row(auto.decades)}
        </section>
      )}
      {!albums.length && !auto.occasions.length && !auto.decades.length && <p className="muted">No albums yet. Start one to gather photos together.</p>}
    </div>
  );
}
