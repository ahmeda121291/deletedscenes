import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://deletedscenes.blog";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Deleted Scenes",
    template: "%s · Deleted Scenes",
  },
  description: "the parts that didn't make the cut.",
};

/* one fixed grain overlay — the only texture on the site */
const GRAIN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50"
          style={{ backgroundImage: `url("${GRAIN}")`, opacity: 0.02 }}
        />
        {children}
      </body>
    </html>
  );
}
