import type { Metadata } from "next";
import Link from "next/link";
import { GoToEnter } from "./GoToEnter";

// The link preview in a text: "My prayers", "Dunya Family", and the Polaroid picture. Nothing private is on this page.
export const metadata: Metadata = {
  title: "My prayers",
  description: "Dunya Family",
  openGraph: { title: "My prayers", description: "Dunya Family", siteName: "Dunya Family", type: "website", images: [{ url: "/og-prayer.png", width: 1200, height: 630, alt: "Dunya Family prayer requests" }] },
  twitter: { card: "summary_large_image", title: "My prayers", description: "Dunya Family", images: ["/og-prayer.png"] },
};

/** Someone who isn't signed in yet passes through here to the family password, then on to My prayers. */
export default async function SharePrayer({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const next = (await searchParams).tab === "mine" ? "/prayer?tab=mine" : "/prayer";
  const href = `/enter?next=${encodeURIComponent(next)}`;
  return (
    <div className="share-pass">
      <GoToEnter href={href} />
      <p>Dunya Family</p>
      <Link href={href} className="btn btn-primary">Come in</Link>
    </div>
  );
}
