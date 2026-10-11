import { redirect } from "next/navigation";
import { SwitchPerson } from "@/components/SwitchPerson";
import { getSession } from "@/lib/auth";
import { pickablePeople } from "@/lib/me";

export const dynamic = "force-dynamic";

/** "Not Mary? Switch person": this device stays signed in and picks someone else. */
export default async function WhoPage() {
  const s = await getSession();
  if (!s) redirect("/enter");
  return <SwitchPerson people={await pickablePeople()} current={s.pid ?? null} />;
}
