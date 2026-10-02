import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Velcro Ethereal — Shop Segera Hadir",
  description: "Halaman shop Velcro Ethereal sedang dalam pengembangan.",
};

/**
 * Tujuan redirect semua jalur belanja (/shop, /cart, /checkout) selama
 * NEXT_PUBLIC_SHOP_OPEN belum "true" — lihat lib/shop-status.ts dan proxy.ts.
 * Sengaja di dalam (main) supaya header dan footer tetap tampil.
 */
export default function ShopSegeraPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ink px-6 py-32 text-center text-cream sm:py-44">
      <div className="max-w-xl">
        <p className="font-jost mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold">
          Segera Hadir
        </p>
        <h1 className="font-serif text-4xl font-light italic leading-tight sm:text-5xl">
          Halaman shop sedang dikembangkan.
        </h1>
        <div className="mx-auto my-8 h-px w-14 bg-gold" aria-hidden="true" />
        <p className="text-base leading-relaxed text-cream/70">
          Kami sedang menyiapkan sistem pembayaran agar belanja Anda aman dan
          nyaman. Sementara itu, silakan menjelajahi koleksi kami atau hubungi
          kami untuk informasi lebih lanjut.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/"
            className="font-jost inline-flex items-center gap-3 rounded-full border border-gold px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors duration-300 hover:bg-gold hover:text-ink"
          >
            Kembali ke Beranda
          </Link>
          <Link
            href="/kontak"
            className="font-jost text-sm font-medium uppercase tracking-[0.2em] text-cream/70 transition-colors hover:text-gold"
          >
            Hubungi Kami
          </Link>
        </div>
      </div>
    </main>
  );
}
