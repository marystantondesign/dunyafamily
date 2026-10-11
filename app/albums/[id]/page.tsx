import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumActions } from "@/components/AlbumActions";
import { BrowseResults } from "@/components/BrowseResults";
import { Icon } from "@/components/Icon";
import { albumOptions, getAlbum } from "@/lib/albums";
import { canRemove, getSession } from "@/lib/auth";
import { listOccasions, listPeople } from "@/lib/data";
import { countPhotos, findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ order?: string }> }) {
  const album = await getAlbum(Number((await params).id));
  if (!album) notFound();
  const sp = await searchParams;
  const order = sp.order === "oldest" ? "oldest" : "newest";
  const filters = { albums: [album.id] };
  const [s, photos, total, people, occasions, albums] = await Promise.all([
    getSession(), findPhotos(filters, { order, limit: 1000 }), countPhotos(filters), listPeople(), listOccasions(), albumOptions(),
  ]);
  const query = `albums=${album.id}${order === "oldest" ? "&order=oldest" : ""}`;
  const owner = canRemove(s, album.created_by_device);

  return (
    <>
      <Link href="/albums" className="back-link"><Icon name="chevronLeft" size={18} /> All albums</Link>
      <div className="page-head with-actions">
        <div>
          <h1 className="display">{album.title}</h1>
          <p>{total} {total === 1 ? "photo" : "photos"}{album.created_by_name ? `. Started by ${album.created_by_name}` : ""}. Everyone can add to this album.</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href={`/upload?album=${album.id}`} className="btn btn-primary"><Icon name="plus" size={18} /> Add photos</Link>
          {owner && <AlbumActions id={album.id} title={album.title} />}
        </div>
      </div>
      {photos.length ? (
        <BrowseResults
          photos={photos.map((p) => ({ id: p.id, url: p.url, width: p.width, height: p.height, year: p.year, decade: p.decade, month: p.month, removable: canRemove(s, p.uploaded_by_device) }))}
          query={query}
          total={total}
          people={people.map(({ id, name, aliases }) => ({ id, name, aliases }))}
          occasions={occasions}
          albums={albums}
          inAlbum={{ id: album.id, title: album.title }}
        />
      ) : (
        <p className="muted">No photos here yet. Add new ones, or open any photo and choose Add to an album. In Browse, Select lets you add many at once.</p>
      )}
    </>
  );
}
