import { SiWhatsapp } from "react-icons/si";

/**
 * Tombol WhatsApp melayang di pojok kanan bawah, muncul di semua halaman route
 * group (main). Server Component — tidak ada state/hook, cukup <a> biasa.
 *
 * Warna sengaja memakai palet brand (gold di atas ink), BUKAN hijau WhatsApp:
 * situs ini gelap-emas sepanjang halaman dan satu-satunya elemen hijau yang
 * menempel permanen di layar akan jadi titik paling mencolok di seluruh
 * komposisi. Ikon WhatsApp-nya sendiri sudah cukup untuk mengenali fungsinya.
 *
 * `href` dirakit pemanggil (layout) dari nomor + pesan awal di CMS; kalau
 * nomornya belum diisi admin, layout tidak merender komponen ini sama sekali.
 */
export default function WhatsAppFloatingButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Hubungi kami via WhatsApp (buka di tab baru)"
      className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-ink-soft text-gold shadow-lg shadow-black/40 transition-colors duration-300 hover:bg-gold hover:text-ink sm:bottom-8 sm:right-8"
    >
      <SiWhatsapp className="text-2xl" aria-hidden="true" />
    </a>
  );
}
