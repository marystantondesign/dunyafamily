import { Uploader } from "@/components/Uploader";
import { albumOptions } from "@/lib/albums";
import { listOccasions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  const [occasions, albums, sp] = await Promise.all([listOccasions(), albumOptions(), searchParams]);
  const start = albums.find((a) => a.id === Number(sp.album));
  return (
    <>
      <div className="page-head">
        <h1 className="display">{start ? `Add photos to ${start.title}` : "Add photos"}</h1>
        <p>Upload now. Add names and details whenever you&apos;re ready.</p>
      </div>
      <Uploader occasions={occasions} albums={albums} startAlbum={start?.id} />
    </>
  );
}
