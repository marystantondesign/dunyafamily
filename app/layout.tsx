import { siteUrl } from "@/lib/sms";
import type { Metadata, Viewport } from "next";
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
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "48x48" }],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Dunya Fam" },
  // Next writes the newer mobile-web-app-capable tag; older iPhones still look for the Apple one.
  other: { "apple-mobile-web-app-capable": "yes" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export const viewport: Viewport = { themeColor: "#FBF7F0" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { session: s, stale } = await sessionState();
  // A family device from before the last password change, or signed in as someone who can't sign in: sign it out.
  if (stale) redirect(stale === "password" ? "/api/logout" : "/api/logout?who=1");
  const me = s ? await whoAmI(s) : null;
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${hand.variable}`}>
      <body>
        {/* Signed out (the password and Who are you? screens): no header, so more of the family fits on screen. */}
        {me && <SiteHeader me={me} />}
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
