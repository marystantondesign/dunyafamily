import { redirect } from "next/navigation";
import { PrayerBoard } from "@/components/PrayerBoard";
import { getSession } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { whoAmI } from "@/lib/me";
import { prayerPage } from "@/lib/prayer";

export const dynamic = "force-dynamic";

export default async function PrayerPage({ searchParams }: { searchParams: Promise<{ earlier?: string; tab?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/enter");
  const sp = await searchParams;
  const earlier = sp.earlier === "1";
  const [data, people, me] = await Promise.all([prayerPage(s, earlier), listPeople(), whoAmI(s)]);
  return (
    <PrayerBoard
      {...data}
      earlier={earlier}
      tab={sp.tab === "mine" ? "mine" : "all"}
      me={{ name: me.name, avatarUrl: me.avatarUrl }}
      people={people.map((p) => ({ id: p.id, name: p.name, aliases: p.aliases, avatarUrl: p.avatar_url }))}
    />
  );
}
