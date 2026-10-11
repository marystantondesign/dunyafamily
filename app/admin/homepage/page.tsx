import Link from "next/link";
import { notFound } from "next/navigation";
import { HomepagePhotos } from "@/components/HomepagePhotos";
import { Icon } from "@/components/Icon";
import { getSession, isAdmin } from "@/lib/auth";
import { listPeople } from "@/lib/data";
import { findDunya } from "@/lib/featured";
import { homepageList } from "@/lib/homepage";
import { displayName } from "@/lib/names";

export const dynamic = "force-dynamic";

/** Homepage photos (admin): mockups 11 and 12. */
export default async function HomepagePhotosPage() {
  if (!isAdmin(await getSession())) notFound();
  const [{ items, seconds }, people, dunya] = await Promise.all([homepageList(), listPeople(), findDunya()]);
  return (
    <div className="admin-page wide">
      <p className="crumbs desktop-only"><Link href="/you">Settings</Link> / Admin</p>
      <Link href="/you" className="back-link phone-only"><Icon name="chevronLeft" size={18} /> Settings</Link>
      <HomepagePhotos initial={items} seconds={seconds} people={people.map(({ id, name }) => ({ id, name }))}
        dunya={dunya ? { id: dunya.id, name: displayName(dunya.name) } : null} />
    </div>
  );
}
