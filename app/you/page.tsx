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
          <Link href="/you/reminders">
            <span><strong>Text reminders</strong><span>A short text with your prayers and family dates</span></span>
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

      {me.role === "admin" && (
        <>
          <h2 className="you-label">Admin</h2>
          <ul className="you-list">
            <li>
              <Link href="/admin/homepage">
                <span><strong>Homepage photos</strong><span>Choose the photos and captions on the Polaroid</span></span>
                <Icon name="chevronRight" className="chev" />
              </Link>
            </li>
            <li>
              <Link href="/admin/family">
                <span><strong>Family tree</strong><span>Parents, siblings, partners, children, and birth years</span></span>
                <Icon name="chevronRight" className="chev" />
              </Link>
            </li>
            <li>
              <Link href="/admin/deleted">
                <span><strong>Recently deleted</strong><span>Restore photos, people, and events</span></span>
                <Icon name="chevronRight" className="chev" />
              </Link>
            </li>
            <li>
              <Link href="/admin/texts">
                <span><strong>Texts sent</strong><span>Every reminder and code text, and any that failed</span></span>
                <Icon name="chevronRight" className="chev" />
              </Link>
            </li>
            <li>
              <Link href="/admin/password">
                <span><strong>Family password</strong><span>Change it. Everyone will need the new one.</span></span>
                <Icon name="chevronRight" className="chev" />
              </Link>
            </li>
          </ul>
        </>
      )}

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
