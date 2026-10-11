import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/SiteHeader";
import { YouLogOut } from "@/components/YouLogOut";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth";
import { whoAmI } from "@/lib/me";

export const dynamic = "force-dynamic";

/** You and settings (screen 24): this device's person, their details and calendar, and switching or logging out. */
export default async function YouPage() {
  const s = await getSession();
  if (!s) redirect("/enter");
  const me = await whoAmI(s);
  const first = me.name.split(" ")[0];
  return (
    <div className="you">
      <div className="you-head">
        <Avatar me={me} className="you-avatar" />
        <div>
          <h1>{me.name}</h1>
          <Link href={me.pid ? `/people/${me.pid}` : "/enter/who"}>{me.pid ? "See your page" : "Pick yourself to get a page"}</Link>
        </div>
      </div>

      <h2 className="you-label">You</h2>
      <ul className="you-list">
        <li>
          <Link href={me.pid ? `/people/${me.pid}/edit` : "/enter/who"}>
            <span><strong>Your details</strong><span>Birthday, address, important dates</span></span>
            <Icon name="chevronRight" className="chev" />
          </Link>
        </li>
        <li>
          <Link href="/calendar#subscribe">
            <span><strong>Your calendar</strong><span>Add birthdays and gatherings to Google or Apple Calendar</span></span>
            <Icon name="chevronRight" className="chev" />
          </Link>
        </li>
      </ul>

      <h2 className="you-label">This phone</h2>
      <ul className="you-list">
        <li>
          <Link href="/enter/who">
            <span><strong>Not {first}? Switch person</strong></span>
            <Icon name="chevronRight" className="chev" />
          </Link>
        </li>
        <li><YouLogOut /></li>
      </ul>
    </div>
  );
}
