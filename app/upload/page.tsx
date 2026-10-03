import { Uploader } from "@/components/Uploader";
import { listOccasions, listPeople } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const [people, occasions] = await Promise.all([listPeople(), listOccasions()]);
  return (
    <>
      <h1 className="display" style={{ marginTop: 32 }}>Add photos</h1>
      <p className="muted">Add a batch, then tag everything in it at once. You can fine-tune single photos later.</p>
      <Uploader people={people.map(({ id, name, aliases }) => ({ id, name, aliases }))} occasions={occasions} />
    </>
  );
}
