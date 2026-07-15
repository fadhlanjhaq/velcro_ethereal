import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

// Body: sans netral (pengganti Calibri yang diminta brief — bukan web font).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Heading: serif heritage (pengganti Cambria yang diminta brief — bukan web font).
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Velcro Ethereal",
  description:
    "Velcro Ethereal — koleksi jaket heritage dengan bordir artisanal. Warisan yang dirancang untuk abadi.",
};

/**
 * Root layout minimal — hanya <html>/<body>, font, dan token global.
 * Chrome situs utama (SmoothScroll + Cart + SiteHeader/SiteFooter) dipindah ke
 * route group (main)/layout.tsx supaya halaman standalone seperti /info
 * (link-in-bio, dibuka dari bio Instagram) TIDAK mewarisi header/footer/cart.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
