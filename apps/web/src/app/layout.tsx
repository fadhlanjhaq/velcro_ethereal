import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { CartProvider } from "@/context/CartContext";

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
  title: "Velcro Ethereal — Heritage Wearables",
  description:
    "Velcro Ethereal — koleksi jaket heritage dengan bordir artisanal. Warisan yang dirancang untuk abadi.",
};

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
      <body className="min-h-full flex flex-col">
        <SmoothScrollProvider>
          <CartProvider>
            <SiteHeader />
            {children}
            <SiteFooter />
          </CartProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
