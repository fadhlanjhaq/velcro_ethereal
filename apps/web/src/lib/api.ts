/**
 * Klien data produk — sumber kebenaran runtime (menggantikan lib/mock-products.ts).
 *
 * Tipe di-reuse dari mock-products.ts via `import type` (hanya tipe, dihapus saat
 * compile) supaya tidak ada data mock yang ikut ter-bundle di runtime — mock
 * hanya bertahan sebagai referensi bentuk data. Bentuk payload API (App\Http\
 * Resources\* di apps/api) sudah dibuat PERSIS sama dengan interface ini.
 */
import { cache } from "react";
import type {
  MockCategory,
  MockProduct,
  MockProductImage,
  MockProductVariant,
} from "./mock-products";

export type Category = MockCategory;
export type ProductImage = MockProductImage;
export type ProductVariant = MockProductVariant;
export type Product = MockProduct;

/**
 * Konten landing page yang dikelola lewat admin panel (tabel site_contents +
 * site_content_items di apps/api). Berbeda dari tipe produk di atas, bentuk ini
 * tidak punya padanan di mock-products.ts — kontraknya didefinisikan langsung di
 * sini dan mengikuti App\Http\Resources\SiteContentResource.
 *
 * Field bernilai `null` kalau admin belum mengisinya: resource di backend selalu
 * mengirim seluruh key (repeater jadi array kosong), jadi bentuk payload tetap
 * sama dan konsumen tidak perlu menjaga keberadaan key.
 */
export interface AnnouncementItem {
  text: string | null;
}

export interface AnnouncementBarContent {
  items: AnnouncementItem[];
}

export interface HeroContent {
  eyebrow: string | null;
  headline_upright: string | null;
  headline_italic: string | null;
  tagline: string | null;
  scroll_cue: string | null;
  video_url: string | null;
  poster_image: string | null;
}

export interface BrandStoryPillar {
  title: string | null;
  body: string | null;
}

export interface BrandStoryContent {
  eyebrow: string | null;
  heading: string | null;
  /** Nomor urut ("01", "02", ...) di-derive dari urutan array ini saat render. */
  pillars: BrandStoryPillar[];
}

export interface CraftsmanshipImage {
  url: string | null;
  /** Nilai untuk atribut data-parallax; null → dipakai default di komponen. */
  parallax_speed: number | null;
  role: string | null;
}

export interface CraftsmanshipContent {
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  images: CraftsmanshipImage[];
}

export interface ClosingCtaContent {
  eyebrow: string | null;
  heading: string | null;
  secondary_line: string | null;
  cta_label: string | null;
  cta_href: string | null;
}

/** Platform yang ikonnya dipetakan di frontend (lihat /kontak). */
export type SocialPlatform = "instagram" | "whatsapp" | "shopee" | "tiktok";

export interface SocialLink {
  /** Longgar (string), bukan SocialPlatform: nilainya berasal dari database
   *  sehingga platform tak dikenal harus tetap bisa dirender tanpa ikon. */
  platform: string | null;
  label: string | null;
  url: string | null;
}

export interface ContactContent {
  address: string | null;
  email: string | null;
  phone: string | null;
  /** Nomor polos tanpa "+", mis. "628131453336" — URL wa.me dirakit di
   *  konsumen supaya pesan awalnya bisa beda per konteks. */
  whatsapp_number: string | null;
  whatsapp_message: string | null;
  maps_url: string | null;
  social_links: SocialLink[];
}

export interface SiteContent {
  announcement_bar: AnnouncementBarContent;
  hero: HeroContent;
  brand_story: BrandStoryContent;
  craftsmanship: CraftsmanshipContent;
  closing_cta: ClosingCtaContent;
  contact: ContactContent;
}

/**
 * Rakit URL wa.me dari nomor + pesan awal. Mengembalikan null kalau nomornya
 * belum diisi admin, supaya pemanggil bisa menyembunyikan tombolnya.
 */
export function buildWhatsAppUrl(
  number: string | null,
  message: string | null,
): string | null {
  const digits = number?.replace(/\D/g, "");
  if (!digits) return null;

  const base = `https://wa.me/${digits}`;
  return message
    ? `${base}?text=${encodeURIComponent(message)}`
    : base;
}

// URL Laravel lokal (Herd). Sama dengan target rewrites di next.config.ts,
// bisa di-override via env untuk Docker/production.
const LARAVEL_API_URL =
  process.env.LARAVEL_API_URL ?? "http://velcro-api.test";

/**
 * Resolusi URL fetch:
 * - Server Component (typeof window === "undefined"): panggil Laravel langsung,
 *   karena URL relatif tidak bisa di-resolve di server.
 * - Browser: pakai path same-origin "/api/..." yang di-proxy next.config
 *   rewrites → Laravel (paritas dengan nginx reverse proxy di production).
 */
function apiUrl(path: string): string {
  if (typeof window === "undefined") {
    return `${LARAVEL_API_URL}${path}`;
  }
  return path;
}

/** Bentuk envelope default Laravel API Resource: `{ data: ... }`. */
interface Envelope<T> {
  data: T;
}

/** Daftar semua produk aktif. */
export async function getProducts(): Promise<Product[]> {
  // no-store: katalog kecil & kita ingin data selalu mencerminkan DB (bukan
  // snapshot build-time). Bisa diganti revalidate saat perlu caching nanti.
  const res = await fetch(apiUrl("/api/products"), { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Gagal memuat daftar produk (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as Envelope<Product[]>;
  return json.data;
}

/** Detail satu produk berdasarkan slug. `null` kalau tidak ditemukan (404). */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(slug)}`), {
    cache: "no-store",
  });

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`Gagal memuat produk "${slug}" (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as Envelope<Product>;
  return json.data;
}

/**
 * Konten seluruh section landing page.
 *
 * Dibungkus `cache()` React karena dipanggil dua kali dalam satu request —
 * (main)/layout.tsx untuk announcement bar di SiteHeader, dan (main)/page.tsx
 * untuk section landing. Keduanya dirender dalam satu render pass, jadi
 * memoization ini membuatnya cukup satu HTTP call.
 *
 * revalidate 60 (bukan no-store seperti katalog produk): konten ini jarang
 * berubah — hanya saat admin menyuntingnya lewat panel — jadi tidak perlu
 * round-trip ke Laravel di setiap page view.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const res = await fetch(apiUrl("/api/site-content"), {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Gagal memuat konten situs (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as Envelope<SiteContent>;
  return json.data;
});

/** Payload yang dikirim ke POST /api/orders (lihat App\Http\Requests\StoreOrderRequest). */
export interface CreateOrderPayload {
  /** UUID per percobaan checkout — backend men-dedup klik ganda / retry. */
  idempotency_key: string;
  guest_name: string;
  guest_email: string;
  phone: string;
  address: string;
  items: { product_variant_id: number; quantity: number }[];
}

/** Bentuk data yang dikembalikan POST /api/orders saat sukses (envelope `{ data }`). */
export interface CreatedOrder {
  order_number: string;
  snap_token: string;
  gross_amount: number;
}

/**
 * Buat order dari isi cart + minta Snap token Midtrans (backend yang bicara ke
 * Midtrans). Dipanggil saat submit form /checkout.
 *
 * Sukses: 201 (order baru) atau 200 (idempotency-hit — key ini sudah pernah
 * diproses). Body keduanya sama: `{ data: { order_number, snap_token,
 * gross_amount } }`, jadi `res.ok` (true untuk 200 & 201) menangani keduanya.
 *
 * Backend sudah mengembalikan pesan error berbahasa Indonesia yang layak
 * ditampilkan ke user:
 * - 422 → validasi / stok tidak cukup / produk nonaktif (`body.message` apa adanya)
 * - 409 → order dengan key ini masih diproses (`body.message` apa adanya)
 * - 502 → gagal menghubungi payment gateway (`body.message` generik)
 */
export async function postOrder(payload: CreateOrderPayload): Promise<CreatedOrder> {
  const res = await fetch(apiUrl("/api/orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    // Coba ambil pesan dari body; kalau body bukan JSON, fallback ke pesan generik.
    const message = await res
      .json()
      .then((body: { message?: string }) => body?.message)
      .catch(() => undefined);

    if (
      (res.status === 422 || res.status === 409 || res.status === 502) &&
      message
    ) {
      throw new Error(message);
    }
    throw new Error(message ?? `Gagal membuat order (HTTP ${res.status}).`);
  }

  const json = (await res.json()) as Envelope<CreatedOrder>;
  return json.data;
}

/**
 * Format harga (string decimal dari API, mis. "850000.00") → Rupiah
 * ("Rp 850.000"). Sengaja didefinisikan di sini (bukan diimpor dari
 * mock-products.ts) agar runtime tidak bergantung pada file mock.
 */
export function formatRupiah(basePrice: string): string {
  const value = Number.parseFloat(basePrice);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
