import { Uploader } from "@/components/Uploader";
import { listOccasions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const occasions = await listOccasions();
  return (
    <>
      <div className="page-head">
        <h1 className="display">Add photos</h1>
        <p>Upload now. Add names and details whenever you&apos;re ready.</p>
      </div>
      <Uploader occasions={occasions} />
    </>
  );
}
