import Link from "next/link";
import { notFound } from "next/navigation";
import { AlbumActions } from "@/components/AlbumActions";
import { BrowseResults } from "@/components/BrowseResults";
import { Icon } from "@/components/Icon";
import { CreatedToast } from "@/components/CreatedToast";
import { canAddTo, getAlbum, myAlbumOptions } from "@/lib/albums";
import { canRemove, getSession } from "@/lib/auth";
import { listOccasions, listPeople } from "@/lib/data";
import { countPhotos, findPhotos } from "@/lib/photos";

export const dynamic = "force-dynamic";

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ order?: string; created?: string }> }) {
  const album = await getAlbum(Number((await params).id));
  if (!album) notFound();
  const sp = await searchParams;
  const order = sp.order === "oldest" ? "oldest" : "newest";
  const filters = { albums: [album.id] };
  const [s, photos, total, people, occasions, albums] = await Promise.all([
    getSession(), findPhotos(filters, { order, limit: 1000 }), countPhotos(filters), listPeople(), listOccasions(), getSession().then(myAlbumOptions),
  ]);
  const query = `albums=${album.id}${order === "oldest" ? "&order=oldest" : ""}`;
  const owner = canAddTo(s, album);
  // Just made from Browse: back goes to Browse, with a short "Album created".
  const created = sp.created === "1";
  const mine = !!s && (album.created_by_person ? s.pid === album.created_by_person : s.did === album.created_by_device);

  return (
    <>
      {created
        ? <Link href="/browse" className="back-link"><Icon name="chevronLeft" size={18} /> Browse</Link>
        : <Link href="/albums" className="back-link"><Icon name="chevronLeft" size={18} /> All albums</Link>}
      <div className="page-head with-actions album-head">
        <div>
          <h1 className="display">{album.title}</h1>
          <p>{total} {total === 1 ? "photo" : "photos"}{mine ? " · Your album" : album.created_by_name ? `. Started by ${album.created_by_name}.` : "."}</p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          {owner && <Link href="/browse?select=1" className="btn btn-primary album-add-more"><Icon name="plus" size={18} stroke={2.2} /> Add more photos</Link>}
          {owner && <Link href={`/upload?album=${album.id}`} className="btn desktop-only">Upload new photos</Link>}
          {owner && <AlbumActions id={album.id} title={album.title} />}
        </div>
      </div>
      {created && <CreatedToast />}
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
        <p className="muted">{owner ? "No photos here yet. Add new ones, or open any photo and choose Add to an album. In Browse, Select lets you add many at once." : "No photos here yet."}</p>
      )}
    </>
  );
}
