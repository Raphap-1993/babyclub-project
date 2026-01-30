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
  metadataBase: new URL("https://panel.babyclubaccess.com"),
  title: {
    default: "BabyClub Access | Backoffice",
    template: "%s | BabyClub Access Backoffice",
  },
  description: "Admin panel to manage events, codes, tables, and scans.",
  applicationName: "BabyClub Access Backoffice",
  openGraph: {
    title: "BabyClub Access | Backoffice",
    description: "Admin panel to manage events, codes, tables, and scans.",
    url: "/",
    siteName: "BabyClub Access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BabyClub Access | Backoffice",
    description: "Admin panel to manage events, codes, tables, and scans.",
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
      <body className={`${geistSans.variable} ${geistMono.variable} bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
