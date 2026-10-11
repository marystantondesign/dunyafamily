import { AlbumCard } from "@/components/AlbumCard";
import { NewAlbum } from "@/components/NewAlbum";
import { listAlbums } from "@/lib/albums";

export const dynamic = "force-dynamic";

export default async function AlbumsPage() {
  const albums = await listAlbums();
  return (
    <>
      <div className="page-head with-actions">
        <div>
          <h1 className="display">Albums</h1>
          <p>Shared albums anyone in the family can add to, like a wedding or a trip.</p>
        </div>
        <NewAlbum />
      </div>
      {albums.length ? (
        <div className="album-grid">
          {albums.map((a) => (
            <AlbumCard key={a.id} href={`/albums/${a.id}`} title={a.title} count={a.count} photos={a.photos} />
          ))}
        </div>
      ) : <p className="muted">No albums yet. Start one, or choose one when you add photos.</p>}
    </>
  );
}
