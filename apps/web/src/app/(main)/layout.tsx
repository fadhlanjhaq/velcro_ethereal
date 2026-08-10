import SmoothScrollProvider from "@/components/SmoothScrollProvider";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import WhatsAppFloatingButton from "@/components/layout/WhatsAppFloatingButton";
import { CartProvider } from "@/context/CartContext";
import {
  buildWhatsAppUrl,
  getSiteContent,
  type AnnouncementItem,
} from "@/lib/api";

type ChromeContent = {
  announcementItems: AnnouncementItem[];
  whatsappUrl: string | null;
};

/**
 * Announcement bar dan tombol WhatsApp melayang itu elemen pelengkap, bukan
 * konten utama — halaman seperti /cart dan /checkout harus tetap bisa dipakai
 * walau API konten sedang mati. Karena itu kegagalan di-serap DI SINI, bukan di
 * getSiteContent() (yang tetap melempar Error untuk konsumen yang memang
 * bergantung penuh padanya, mis. homepage: Hero/BrandStory/dst adalah isi
 * halamannya).
 */
async function getChromeContent(): Promise<ChromeContent> {
  try {
    const { announcement_bar, contact } = await getSiteContent();

    return {
      announcementItems: announcement_bar.items,
      whatsappUrl: buildWhatsAppUrl(
        contact.whatsapp_number,
        contact.whatsapp_message,
      ),
    };
  } catch (error) {
    // Tetap terlihat di log server (dev maupun production) tanpa menyeret
    // seluruh route group ke error boundary.
    console.error("Gagal memuat konten chrome situs:", error);
    return { announcementItems: [], whatsappUrl: null };
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
  const { announcementItems, whatsappUrl } = await getChromeContent();

  return (
    <SmoothScrollProvider>
      <CartProvider>
        <SiteHeader announcementItems={announcementItems} />
        {children}
        <SiteFooter />
        {/* Disembunyikan total kalau nomor WhatsApp belum diisi admin. */}
        {whatsappUrl && <WhatsAppFloatingButton href={whatsappUrl} />}
      </CartProvider>
    </SmoothScrollProvider>
  );
}
