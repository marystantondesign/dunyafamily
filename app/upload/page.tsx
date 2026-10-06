import { Uploader } from "@/components/Uploader";
import { listOccasions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const occasions = await listOccasions();
  return (
    <>
      <h1 className="display" style={{ marginTop: 32 }}>Add photos</h1>
      <p className="muted">Add a batch and fill in what&apos;s true for all of them. You&apos;ll tag who&apos;s in each photo next.</p>
      <Uploader occasions={occasions} />
    </>
  );
}
