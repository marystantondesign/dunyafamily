import { redirect } from "next/navigation";
import { PrayThrough } from "@/components/PrayThrough";
import { getSession } from "@/lib/auth";
import { prayerPage } from "@/lib/prayer";

export const dynamic = "force-dynamic";

/** Pray through these: the requests in My prayers, one at a time. Nothing is recorded or sent. */
export default async function PrayThroughPage() {
  const s = await getSession();
  if (!s) redirect("/enter");
  const { active } = await prayerPage(s);
  const mine = active.filter((r) => r.mine);
  if (!mine.length) redirect("/prayer?tab=mine");
  return (
    <PrayThrough items={mine.map((r) => ({
      id: r.id, forName: r.forPerson?.name ?? r.forName, about: r.about, howToPray: r.howToPray, from: r.from,
    }))} />
  );
}
