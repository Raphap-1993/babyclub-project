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
  description:
    "Compra de entradas digitales y reservas de mesa para eventos BABY.",
  applicationName: "BabyClub Access",
  openGraph: {
    title: "BabyClub Access",
    description:
      "Compra de entradas digitales y reservas de mesa para eventos BABY.",
    url: "/",
    siteName: "BabyClub Access",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BabyClub Access",
    description:
      "Compra de entradas digitales y reservas de mesa para eventos BABY.",
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
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
