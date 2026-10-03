import type { Metadata } from "next";
import Link from "next/link";
import { Figtree, Young_Serif } from "next/font/google";
import { getSession } from "@/lib/auth";
import "./globals.css";

const serif = Young_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });
const sans = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Dunya Family",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {s && (
          <header className="site-header">
            <Link href="/" className="brand">Dunya Family</Link>
            <nav aria-label="Main">
              <Link href="/browse">Browse</Link>
              <Link href="/people">Family</Link>
              <Link href="/calendar">Birthdays and gatherings</Link>
              <span className="hello">Hi, {s.name}</span>
              <Link href="/upload" className="btn btn-primary">Add photos</Link>
            </nav>
          </header>
        )}
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
