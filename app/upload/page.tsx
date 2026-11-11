import Link from "next/link";
import { Uploader } from "@/components/Uploader";
import { myAlbumOptions } from "@/lib/albums";
import { getSession } from "@/lib/auth";
import { listOccasions } from "@/lib/data";
import { q } from "@/lib/db";
import { signGet } from "@/lib/r2";
import { phoneUploadsLeft } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Add photos: choose photos, the old prints switch, and optional details for all of them. */
export default async function UploadPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const s = await getSession();
  const [occasions, albums, sp, recent, left] = await Promise.all([
    listOccasions(), myAlbumOptions(s), searchParams,
    q<{ id: number; thumb_key: string }>(`select id, thumb_key from photos where deleted_at is null order by created_at desc, id desc limit 10`),
    phoneUploadsLeft(s),
  ]);
  // From an album you started: these photos go into it too.
  const start = albums.find((a) => a.id === Number(sp.album));
  const thumbs = await Promise.all(recent.map(async (r) => ({ id: r.id, url: await signGet(r.thumb_key) })));
  return (
    <div className="upload-page">
      <Uploader occasions={occasions} albums={albums} startAlbum={start?.id} left={left} title={start ? `Add photos to ${start.title}` : "Add photos"}>
        {thumbs.length > 0 && (
          <section className="upload-recent">
            <div className="section-head">
              <h2 className="section-title">Recently added</h2>
              <Link href="/browse?order=recent" className="upload-seeall">See all</Link>
            </div>
            <div className="upload-recent-row">
              {thumbs.map((t) => (
                // eslint-disable-next-line @next/next/no-img-element
                <Link key={t.id} href={`/photos/${t.id}?order=recent`}><img src={t.url} alt="" /></Link>
              ))}
            </div>
          </section>
        )}
      </Uploader>
    </div>
  );
}
