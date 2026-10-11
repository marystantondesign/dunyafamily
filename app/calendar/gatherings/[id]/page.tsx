import { notFound } from "next/navigation";
import { EditGathering } from "@/components/EditGathering";
import { canRemove, getSession, isAdmin } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GatheringPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const s = await getSession();
  const [g] = await q<{ id: number; title: string; date: string; time_note: string | null; location: string | null; notes: string | null; created_by_device: string | null; created_by_name: string | null }>(
    `select id, title, to_char(date, 'YYYY-MM-DD') as date, time_note, location, notes, created_by_device, created_by_name
       from gatherings where id = $1 and deleted_at is null`, [id]);
  if (!g) notFound();
  const mine = !!g.created_by_device && g.created_by_device === s?.did;
  const canEdit = canRemove(s, g.created_by_device);
  const by = g.created_by_name ?? "someone";
  const note = mine ? `Added by you.` : canEdit && isAdmin(s) ? `Added by ${by}. You can edit this because you're an admin.` : `Added by ${by}. Only ${by} or Mary can change it.`;
  return (
    <EditGathering
      gathering={{ id: g.id, title: g.title, date: g.date, timeNote: g.time_note ?? "", location: g.location ?? "", notes: g.notes ?? "" }}
      canEdit={canEdit}
      note={note}
    />
  );
}
