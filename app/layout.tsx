import type { Metadata } from "next";
import { Caveat, Figtree, Libre_Caslon_Text } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import "./globals.css";

const serif = Libre_Caslon_Text({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-serif" });
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const hand = Caveat({ subsets: ["latin"], weight: "500", variable: "--font-hand" });

export const metadata: Metadata = {
  title: "Dunya Family",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${hand.variable}`}>
      <body>
        {s && <SiteHeader name={s.name} />}
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
