import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FaGlobe } from "react-icons/fa";
import { SiWhatsapp, SiShopee, SiTiktok } from "react-icons/si";

/**
 * Halaman /info — link-in-bio (Milestone 7), desain "Clock Wall Heritage" (1a).
 *
 * BERDIRI SENDIRI, bukan bagian dari pengalaman situs utama: dibuka lewat tap
 * link di bio Instagram, jadi hub link sementara sambil situs utama masih dalam
 * proses. Sengaja DI LUAR route group (main) → tidak mewarisi SiteHeader/
 * SiteFooter/cart. Prioritas: ringan, cepat dimuat, mobile-first.
 *
 * STRUKTUR: satu foto full-bleed (clockwall-bg.jpg) sebagai background seluruh
 * halaman + overlay gradient gelap, lalu SEMUA konten (logo, kartu foto produk,
 * tagline, divider, tombol, footer) satu kolom vertikal center di atasnya.
 * Angka spacing/ukuran mengikuti spek desain 1a; breakpoint desktop di 900px
 * (via arbitrary variant min-[900px]:, bukan md/lg default Tailwind).
 *
 * CATATAN LINK: whatsapp/shopee/tiktok di bawah masih PLACEHOLDER menunggu data
 * asli dari client (shopee & whatsapp dari brief, tiktok belum diberikan).
 * Tombol "Website Kami" aktif (dibuka atas keputusan owner, 5 Nov 2026): link
 * internal ke homepage "/" lewat next/link, buka di tab yang sama.
 */

// ── Ubah link di sini ────────────────────────────────────────────────────────
const LINKS = {
  shopee: "https://id.shp.ee/PF2SRdhu",
  tiktok: "https://www.tiktok.com/@velcroethereal", // PLACEHOLDER — tunggu data client
  whatsapp: "https://wa.me/628131453336",
};

export const metadata: Metadata = {
  title: "Velcro Ethereal — Info",
  description:
    "Hubungi dan belanja Velcro Ethereal — Luxury Heritage Streetwear. Website, WhatsApp, Shopee, dan TikTok resmi.",
};

type ActiveLink = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const ACTIVE_LINKS: ActiveLink[] = [
  { label: "Belanja di Shopee", href: LINKS.shopee, Icon: SiShopee },
  { label: "Ikuti di TikTok", href: LINKS.tiktok, Icon: SiTiktok },
  { label: "Hubungi via WhatsApp", href: LINKS.whatsapp, Icon: SiWhatsapp },
];

// Class bersama semua tombol aktif (Website Kami + tautan eksternal) —
// fill solid ink-soft + aksen gold, ikon gold yang berubah ink saat hover.
const ACTIVE_BUTTON_CLASS =
  "group ve-fade-in flex w-full items-center justify-center gap-3 rounded-full border border-gold/30 bg-ink-soft px-6 py-4 text-sm font-medium tracking-wide text-cream transition-colors duration-200 hover:border-gold hover:bg-gold hover:text-ink min-[900px]:text-[15px]";
const ACTIVE_ICON_CLASS =
  "text-lg text-gold transition-colors duration-200 group-hover:text-ink";

// Overlay gelap di atas foto background: terang di atas (foto masih terbaca),
// makin pekat ke bawah supaya tombol & teks kontras.
const OVERLAY_GRADIENT =
  "linear-gradient(180deg, rgba(15,12,8,.15) 0%, rgba(15,12,8,.35) 40%, rgba(12,9,6,.92) 72%, rgba(10,7,5,.98) 100%)";

export default function InfoPage() {
  return (
    <main className="relative flex-1 overflow-x-hidden bg-ink text-cream">
      {/* ── Background full-bleed: absolute inset-0 mengikuti tinggi halaman
          penuh (bukan cuma viewport pertama), object-cover. Blur halus supaya
          tekstur ramai clock-wall tidak bersaing dengan konten di atasnya
          (foto produk asset_04.jpg TIDAK di-blur — hanya background ini).
          scale(1.08) WAJIB menyertai blur: filter blur "memudarkan" pixel di
          tepi gambar, scale mendorong tepi buram itu keluar dari area
          terlihat; overflow-hidden pada wrapper meng-clip sisa bleed-nya. ── */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <Image
          src="/images/brand/clockwall-bg.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ filter: "blur(4px)", transform: "scale(1.08)" }}
        />
      </div>
      <div
        className="absolute inset-0 z-[1]"
        style={{ background: OVERLAY_GRADIENT }}
        aria-hidden
      />

      {/* ── Kolom konten ── */}
      <div className="relative z-[2] mx-auto flex min-h-screen w-full max-w-[420px] flex-col items-center justify-center px-6 pb-7 pt-9 min-[900px]:min-h-0 min-[900px]:max-w-[640px] min-[900px]:px-12 min-[900px]:py-[72px]">
        {/* Logo — dipasang apa adanya sesuai spek (width 92px/130px, height
            auto). PNG-nya kanvas 2000×2000 dengan padding transparan bawaan di
            sekeliling wordmark; spek mengukur KANVAS, jadi padding itu ikut
            jadi ruang di sekitar logo. */}
        <h1 className="ve-fade-in mb-4 min-[900px]:mb-[26px]">
          <Image
            src="/images/logo/velcro-logo.png"
            alt="Velcro Ethereal"
            width={2000}
            height={2000}
            priority
            className="h-auto w-[92px] min-[900px]:w-[130px]"
          />
        </h1>

        {/* Kartu foto produk. Caption "Velcro Collections on 2026" / "Seafarer
            Wafe Knit" sudah baked-in di asset_04.jpg — BUKAN elemen UI, jangan
            overlay teks apa pun. Rasio kartu 1/1.02 (hampir persegi) memotong
            sebagian atas-bawah foto 3:4 (object-cover, center). */}
        <div
          className="ve-fade-in relative mb-5 aspect-[1/1.02] w-full overflow-hidden rounded-md shadow-[0_10px_30px_rgba(0,0,0,.4)] min-[900px]:mb-[26px] min-[900px]:max-w-[320px]"
          style={{ animationDelay: "0.06s" }}
        >
          <Image
            src="/images/product/asset_04.jpg"
            alt="Velcro Ethereal — Seafarer Wafe Knit, Velcro Collections on 2026"
            fill
            priority
            sizes="(min-width: 900px) 320px, 100vw"
            className="object-cover"
          />
        </div>

        <p
          className="ve-fade-in mt-[2px] w-fit rounded-full px-4 py-1.5 font-serif text-[14px] font-medium uppercase italic tracking-[3px] text-gold backdrop-blur-[8px] min-[900px]:text-[16px]"
          style={{
            animationDelay: "0.12s",
            background: "rgba(10,7,5,.55)",
          }}
        >
          Setiap Karya Punya Makna
        </p>
        {/* Divider tipis gold: pantulan bayangan emas yang lembut
            (transparent → gold → transparent), pendek & terpusat. */}
        <div
          className="mt-3 h-px w-[38px] min-[900px]:w-[48px]"
          style={{
            background:
              "linear-gradient(to right, transparent, #B8935A, transparent)",
          }}
        />

        {/* ── Daftar tombol — margin-top tetap (bukan mt-auto) supaya jarak
            dari divider proporsional & konsisten di semua tinggi viewport;
            seluruh blok konten dipusatkan sebagai satu kesatuan lewat
            justify-center di container kolom, bukan dipisah grup atas/bawah. ── */}
        <nav className="mt-8 flex w-full flex-col gap-3 min-[900px]:mt-10 min-[900px]:max-w-[400px]">
          {/* a. Website Kami — link internal ke homepage "/" (next/link, tab
              yang sama), style identik dengan tombol aktif lainnya */}
          <Link
            href="/"
            className={ACTIVE_BUTTON_CLASS}
            style={{ animationDelay: "0.08s" }}
          >
            <FaGlobe className={ACTIVE_ICON_CLASS} aria-hidden />
            <span>Website Kami</span>
          </Link>

          {/* b–d. Tautan eksternal — fill solid ink-soft + aksen gold */}
          {ACTIVE_LINKS.map(({ label, href, Icon }, i) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={ACTIVE_BUTTON_CLASS}
              style={{ animationDelay: `${0.16 + i * 0.08}s` }}
            >
              <Icon className={ACTIVE_ICON_CLASS} aria-hidden />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        {/* ── Footer minimal ── */}
        <footer className="ve-fade-in mt-[18px] text-center" style={{ animationDelay: "0.4s" }}>
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-cream/35">
            © {new Date().getFullYear()} Velcro Ethereal
          </p>
        </footer>
      </div>
    </main>
  );
}
