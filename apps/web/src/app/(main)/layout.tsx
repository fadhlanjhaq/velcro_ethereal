import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { CartProvider } from "@/context/CartContext";
import { getSiteContent, type AnnouncementItem } from "@/lib/api";

/**
 * Announcement bar itu elemen pelengkap, bukan konten utama — halaman seperti
 * /cart dan /checkout harus tetap bisa dipakai walau API konten sedang mati.
 * Karena itu kegagalan di-serap DI SINI, bukan di getSiteContent() (yang tetap
 * melempar Error untuk konsumen yang memang bergantung penuh padanya, mis.
 * homepage: Hero/BrandStory/dst adalah isi halamannya).
 */
async function getAnnouncementItems(): Promise<AnnouncementItem[]> {
  try {
    const { announcement_bar } = await getSiteContent();
    return announcement_bar.items;
  } catch (error) {
    // Tetap terlihat di log server (dev maupun production) tanpa menyeret
    // seluruh route group ke error boundary.
    console.error("Gagal memuat announcement bar:", error);
    return [];
  }
}

/**
 * Layout situs utama (landing, shop, cart, checkout).
 * Menyediakan chrome bersama: smooth scroll (Lenis), cart context, header, dan
 * footer. Halaman standalone /info sengaja berada DI LUAR route group ini agar
 * tidak mewarisi elemen-elemen tersebut.
 *
 * Fragment sengaja dipakai (bukan wrapper div) supaya SiteHeader/children/
 * SiteFooter tetap menjadi anak langsung <body class="flex flex-col"> — footer
 * tetap terdorong ke bawah lewat main.flex-1 seperti sebelum restructure.
 *
 * Announcement bar di-fetch di sini (bukan di page) karena SiteHeader dipakai
 * seluruh route group ini — landing, shop, cart, checkout. getSiteContent()
 * di-memoize lewat cache(), jadi pemanggilan kedua di (main)/page.tsx tidak
 * menambah HTTP call.
 */
export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const announcementItems = await getAnnouncementItems();

  return (
    <SmoothScrollProvider>
      <CartProvider>
        <SiteHeader announcementItems={announcementItems} />
        {children}
        <SiteFooter />
      </CartProvider>
    </SmoothScrollProvider>
  );
}
