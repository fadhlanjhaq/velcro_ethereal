import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import Image from "next/image";

/**
 * Halaman /coming-soon — gate produksi sementara (lihat proxy.ts).
 *
 * BERDIRI SENDIRI, sama seperti /info: di LUAR route group (main), tidak
 * mewarisi SiteHeader/SiteFooter/cart. Dibuka saat gate produksi aktif
 * (NEXT_PUBLIC_SITE_LIVE belum "true") dan me-redirect semua route utama
 * ke sini, ATAU dikunjungi langsung.
 *
 * Desain "Clock Wall Heritage" — reuse clockwall-bg.jpg yang sama dengan
 * /info, dengan treatment overlay mengikuti file referensi desain
 * (public/design-reference/, sudah dihapus setelah build ini — lihat
 * Milestone terkait di docs/MILESTONES.md untuk detail visual).
 *
 * Font Playfair Display: sengaja DI-SCOPE ke halaman ini saja (bukan
 * ditambahkan ke root layout.tsx) supaya halaman lain yang tidak memakainya
 * tidak ikut menanggung beban loading font tambahan. next/font/google aman
 * dipanggil langsung di sebuah page Server Component seperti ini — hasilnya
 * otomatis code-split per rute, tidak bocor ke halaman lain.
 */
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "Velcro Ethereal — Segera Hadir",
  description:
    "Velcro Ethereal — Heritage Collection 2026. Halaman utama sedang dalam penyempurnaan.",
};

// Overlay gelap di atas foto background — nilai persis dari file referensi
// desain (coming-soon.html): terang di atas, makin pekat ke bawah.
const OVERLAY_GRADIENT =
  "linear-gradient(180deg, rgba(15,12,8,.55) 0%, rgba(12,9,6,.8) 55%, rgba(10,7,5,.95) 100%)";

// ── Warna gold #c9a961 — PENGECUALIAN DISENGAJA ─────────────────────────────
// Ini BUKAN token --color-gold (#b8935a) yang dipakai di seluruh halaman lain
// situs. Warna ini SENGAJA dibatasi hanya untuk halaman /coming-soon saja,
// mengikuti file referensi desain persis (public/design-reference/, sudah
// dihapus — lihat docs/MILESTONES.md). Jangan "diperbaiki" jadi token gold
// biasa di sesi berikutnya — dua warna gold berdampingan di halaman berbeda
// ini memang disengaja, bukan inkonsistensi/bug.
const CS_GOLD = "#c9a961";

export default function ComingSoonPage() {
  return (
    <main
      className={`${playfair.variable} relative min-h-screen w-full overflow-hidden bg-ink text-cream`}
    >
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/images/brand/clockwall-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ filter: "brightness(.4) saturate(.9)" }}
        />
      </div>
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: OVERLAY_GRADIENT }}
        aria-hidden
      />

      <div className="relative z-[2] flex min-h-screen flex-col">
        <header className="px-6 pt-10 text-center">
          <p
            className="m-0 text-[14px] uppercase text-[#e8dfd0]"
            style={{
              fontFamily: "var(--font-playfair), serif",
              letterSpacing: "6px",
            }}
          >
            Velcro Ethereal
          </p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <p
            className="m-0 mb-[22px] text-[11px] uppercase tracking-[4px]"
            style={{ color: CS_GOLD }}
          >
            Heritage Collection &mdash; 2026
          </p>

          <h1
            className="m-0 max-w-[640px] text-[44px] italic leading-[1.15] text-cream min-[900px]:text-[64px]"
            style={{ fontFamily: "var(--font-playfair), serif", fontWeight: 500 }}
          >
            Sesuatu yang penuh makna sedang ditenun.
          </h1>

          <div
            className="my-[26px] h-px w-[52px]"
            style={{ background: CS_GOLD }}
            aria-hidden
          />

          <p
            className="m-0 mb-10 max-w-[480px] font-serif text-[19px] italic leading-[1.5] tracking-[.5px] text-cream/75 min-[900px]:text-[21px]"
          >
            Halaman utama kami sedang dalam penyempurnaan. Sementara itu,
            koleksi kami tetap dapat dijangkau melalui jalur belanja pilihan.
          </p>

          <p className="m-0 mb-9 text-[12px] uppercase tracking-[2.5px] text-cream/50">
            Segera Hadir
          </p>

          <a
            href="/info"
            className="inline-flex items-center gap-[10px] rounded-full border px-[34px] py-4 text-[13px] font-medium uppercase tracking-[2px] text-cream transition-colors duration-200 hover:bg-[rgba(201,169,97,.12)]"
            style={{ borderColor: CS_GOLD }}
          >
            More Info &rarr;
          </a>
        </div>

        <footer className="px-6 pb-10 text-center">
          <p className="m-0 text-[9.5px] uppercase tracking-[2px] text-cream/35">
            &copy; 2026 Velcro Ethereal. Limited Production &mdash; Setiap
            Piece Bernomor.
          </p>
        </footer>
      </div>
    </main>
  );
}
