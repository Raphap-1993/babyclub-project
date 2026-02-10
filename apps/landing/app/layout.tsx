import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://babyclubaccess.com"),
  title: {
    default: "BabyClub Access",
    template: "%s | BabyClub Access",
  },
  description: "Tickets, promoters, and event access—built for nightlife operations.",
  applicationName: "BabyClub Access",
  openGraph: {
    title: "BabyClub Access",
    description: "Tickets, promoters, and event access—built for nightlife operations.",
    url: "/",
    siteName: "BabyClub Access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BabyClub Access",
    description: "Tickets, promoters, and event access—built for nightlife operations.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="dns-prefetch" href="//wtwnhqbbcocpnqqsybln.supabase.co" />
        <link rel="preconnect" href="https://wtwnhqbbcocpnqqsybln.supabase.co" crossOrigin="" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
// Force rebuild 1770704103
