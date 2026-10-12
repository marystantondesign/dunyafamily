import { siteUrl } from "@/lib/sms";
import type { Metadata } from "next";
import { Caveat, Figtree, Libre_Caslon_Text } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { redirect } from "next/navigation";
import { sessionState } from "@/lib/auth";
import { whoAmI } from "@/lib/me";
import "./globals.css";

const serif = Libre_Caslon_Text({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const hand = Caveat({ subsets: ["latin"], weight: "500", variable: "--font-hand" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Dunya Family",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { session: s, stale } = await sessionState();
  // A family device from before the last password change: sign it out.
  if (stale) redirect("/api/logout");
  const me = s ? await whoAmI(s) : null;
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${hand.variable}`}>
      <body>
        {me && <SiteHeader me={me} />}
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
