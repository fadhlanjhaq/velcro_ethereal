import type { Metadata } from "next";
import Image from "next/image";
import { SiWhatsapp, SiShopee, SiTiktok } from "react-icons/si";

/**
 * Halaman /info — link-in-bio (Milestone 7).
 *
 * BERDIRI SENDIRI, bukan bagian dari pengalaman situs utama: dibuka lewat tap
 * link di bio Instagram, jadi hub link sementara sambil situs utama masih dalam
 * proses. Sengaja DI LUAR route group (main) → tidak mewarisi SiteHeader/
 * SiteFooter/cart. Prioritas: ringan, cepat dimuat, mobile-first.
 *
 * CATATAN LINK: whatsapp/shopee/tiktok di bawah masih PLACEHOLDER menunggu data
 * asli dari client (shopee & whatsapp dari brief, tiktok belum diberikan).
 * Tombol "Website Utama" sengaja non-aktif karena situs utama masih prototipe/
 * simulasi (checkout belum terima transaksi sungguhan — lihat Milestone 6).
 */

// ── Ubah link di sini ────────────────────────────────────────────────────────
const LINKS = {
  whatsapp: "https://wa.me/628131453336",
  shopee: "https://id.shp.ee/PF2SRdhu",
  tiktok: "https://www.tiktok.com/@velcroethereal", // PLACEHOLDER — tunggu data client
};

export const metadata: Metadata = {
  title: "Velcro Ethereal — Tautan",
  description:
    "Hubungi dan belanja Velcro Ethereal — Luxury Heritage Streetwear. WhatsApp, Shopee, dan TikTok resmi.",
};

type ActiveLink = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const ACTIVE_LINKS: ActiveLink[] = [
  { label: "Hubungi via WhatsApp", href: LINKS.whatsapp, Icon: SiWhatsapp },
  { label: "Belanja di Shopee", href: LINKS.shopee, Icon: SiShopee },
  { label: "Ikuti di TikTok", href: LINKS.tiktok, Icon: SiTiktok },
];

// Tepi bawah foto header berbentuk gelombang halus (Milestone 7).
// Koordinat ternormalisasi 0..1 (objectBoundingBox) → skala ke ukuran header
// berapa pun. Kurva cubic bezier (smooth, ritme natural — bukan zigzag),
// karakternya senada motif ombak bordir brand. Baseline 0.93, amplitudo subtle.
// WAVE_EDGE dipakai ULANG oleh clip-path (bentuk foto) DAN stroke gold (bingkai
// tipis) supaya garis emas mengikuti kurva PERSIS sama.
const WAVE_EDGE =
  "C0.88,0.8967 0.787,0.8967 0.667,0.93 C0.547,0.9633 0.453,0.9633 0.333,0.93 C0.213,0.8967 0.12,0.8967 0,0.93";
const HEADER_CLIP_PATH = `M0,0 L1,0 L1,0.93 ${WAVE_EDGE} L0,0 Z`;
const HEADER_WAVE_STROKE = `M1,0.93 ${WAVE_EDGE}`;

export default function InfoPage() {
  return (
    <main className="relative flex-1 overflow-x-hidden bg-ink text-cream">
      {/* Backdrop watermark logo (Milestone 7b) — hanya di /info.
          Logo asli (putih/transparan) diulang grid rapat lalu container-nya
          dirotasi diagonal. Parent `overflow-hidden` mengurung rotasi supaya
          tidak memunculkan scroll; child oversized (200%) supaya rotasi tak
          menyisakan celah di sudut. Layer DI ATAS warna dasar ink, DI BAWAH
          konten (z-10). Opacity rendah → sekadar tekstur latar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div
          className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 rotate-[-22deg] opacity-[0.07]"
          style={{
            backgroundImage: "url('/images/logo/velcro-logo.png')",
            backgroundRepeat: "repeat",
            backgroundSize: "200px",
          }}
        />
      </div>
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col">
        {/* ── Header: foto brand vertikal, tepi bawah bergelombang + overlay ── */}
        <header className="ve-fade-in relative h-[46vh] min-h-[300px] w-full">
          {/* defs clip-path (koordinat objectBoundingBox, skala mengikuti box) */}
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <clipPath id="infoHeaderWave" clipPathUnits="objectBoundingBox">
                <path d={HEADER_CLIP_PATH} />
              </clipPath>
            </defs>
          </svg>
          {/* Foto + gradient, di-clip jadi tepi bawah bergelombang. */}
          <div
            className="absolute inset-0"
            style={{
              clipPath: "url(#infoHeaderWave)",
              WebkitClipPath: "url(#infoHeaderWave)",
            }}
          >
            <Image
              src="/images/brand/for-info.jpg"
              alt="Velcro Ethereal"
              fill
              priority
              sizes="(max-width: 448px) 100vw, 448px"
              className="object-cover"
            />
            {/* Gradient ke ink supaya teks di bawah tetap terbaca. */}
            <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/10 to-ink" />
          </div>
          {/* Bingkai tipis gold mengikuti PERSIS kurva gelombang (stroke-only,
              vector-effect non-scaling supaya tebal garis konstan). */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path
              d={HEADER_WAVE_STROKE}
              fill="none"
              stroke="#B8935A"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-12 text-center">
            <h1 className="font-serif text-3xl font-medium tracking-wide text-cream sm:text-4xl">
              VELCRO ETHEREAL
            </h1>
            <p className="mt-2 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold">
              Luxury Heritage Streetwear
            </p>
          </div>
        </header>

        {/* ── Daftar tombol ── */}
        <nav className="flex flex-col gap-3 px-6 pt-7">
          {/* a. Website Utama — non-aktif (situs utama masih prototipe/simulasi) */}
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="ve-fade-in flex w-full items-center justify-center gap-2 rounded-full border border-cream/15 px-6 py-4 text-sm font-medium tracking-wide text-cream/40"
            style={{ animationDelay: "0.08s" }}
          >
            <span>Website</span>
            <span className="rounded-full border border-cream/20 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-cream/50">
              Coming Soon
            </span>
          </button>

          {/* b–d. Tombol aktif — fill solid ink-soft + aksen gold */}
          {ACTIVE_LINKS.map(({ label, href, Icon }, i) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="group ve-fade-in flex w-full items-center justify-center gap-3 rounded-full border border-gold/30 bg-ink-soft px-6 py-4 text-sm font-medium tracking-wide text-cream transition-colors duration-200 hover:border-gold hover:bg-gold hover:text-ink"
              style={{ animationDelay: `${0.16 + i * 0.08}s` }}
            >
              <Icon className="text-lg text-gold transition-colors duration-200 group-hover:text-ink" aria-hidden />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        {/* ── Footer minimal ── */}
        <footer className="ve-fade-in mt-auto px-6 pb-8 pt-10 text-center" style={{ animationDelay: "0.4s" }}>
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-cream/35">
            © {new Date().getFullYear()} Velcro Ethereal
          </p>
        </footer>
      </div>
    </main>
  );
}
