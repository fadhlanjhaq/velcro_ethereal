import type { Metadata } from "next";
import { Geist, Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";

// Body: sans netral (pengganti Calibri yang diminta brief — bukan web font).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Heading: serif heritage (pengganti Cambria yang diminta brief — bukan web font).
// style italic ikut di-load (sebelumnya hanya "normal") — Hero.tsx sudah
// memakai class `italic` pada "Ethereal", tapi tanpa style ini browser
// men-sintesis miring dari glyph normal (faux italic), bukan italic asli.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Label UI: teks kecil uppercase berspasi lebar (nav, announcement bar, badge).
// Variable dinamai "--font-jost" (bukan langsung ditulis di @theme) supaya
// tidak bentrok dengan token Tailwind --font-jost yang mengalias ke sini.
const jost = Jost({
  variable: "--font-jost-google",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
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
      className={`${geistSans.variable} ${cormorant.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
