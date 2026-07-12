import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { CartProvider } from "@/context/CartContext";

/**
 * Layout situs utama (landing, shop, cart, checkout).
 * Menyediakan chrome bersama: smooth scroll (Lenis), cart context, header, dan
 * footer. Halaman standalone /info sengaja berada DI LUAR route group ini agar
 * tidak mewarisi elemen-elemen tersebut.
 *
 * Fragment sengaja dipakai (bukan wrapper div) supaya SiteHeader/children/
 * SiteFooter tetap menjadi anak langsung <body class="flex flex-col"> — footer
 * tetap terdorong ke bawah lewat main.flex-1 seperti sebelum restructure.
 */
export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SmoothScrollProvider>
      <CartProvider>
        <SiteHeader />
        {children}
        <SiteFooter />
      </CartProvider>
    </SmoothScrollProvider>
  );
}
