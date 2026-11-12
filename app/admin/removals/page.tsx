import { notFound } from "next/navigation";
import { RemovalQueue } from "@/components/RemovalQueue";
import { getSession, isAdmin } from "@/lib/auth";
import { removalQueue } from "@/lib/removals";

export const dynamic = "force-dynamic";

/** Removal requests (Mary only): photos people asked about from their own profiles. They aren't told the outcome. */
export default async function RemovalsPage() {
  if (!isAdmin(await getSession())) notFound();
  const rows = await removalQueue();
  return (
    <div className="bi-page">
      <h1>Removal requests</h1>
      <p className="ms-only">People asked about these photos of themselves. They aren&apos;t told what you decide.</p>
      <RemovalQueue rows={rows} />
    </div>
  );
}
