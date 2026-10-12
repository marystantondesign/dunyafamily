import Link from "next/link";
import { Uploader } from "@/components/Uploader";
import { albumOptions } from "@/lib/albums";
import { listOccasions } from "@/lib/data";
import { q } from "@/lib/db";
import { signGet } from "@/lib/r2";

export const dynamic = "force-dynamic";

/** Add photos (mockup 54): a big drop area, and the ten newest photos underneath. */
export default async function UploadPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const [occasions, albums, sp, recent] = await Promise.all([
    listOccasions(), albumOptions(), searchParams,
    q<{ id: number; thumb_key: string }>(`select id, thumb_key from photos where deleted_at is null order by created_at desc, id desc limit 10`),
  ]);
  const start = albums.find((a) => a.id === Number(sp.album));
  const thumbs = await Promise.all(recent.map(async (r) => ({ id: r.id, url: await signGet(r.thumb_key) })));
  return (
    <div className="upload-page">
      <div className="page-head upload-head">
        <h1 className="display">{start ? `Add photos to ${start.title}` : "Add photos"}</h1>
        <p>Upload now. Add names and details whenever you&apos;re ready.</p>
      </div>
      <Uploader occasions={occasions} albums={albums} startAlbum={start?.id} />
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
    </div>
  );
}
