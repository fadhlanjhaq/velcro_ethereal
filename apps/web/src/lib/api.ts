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
  /** Jalan, nomor rumah, RT/RW, patokan (maks 500). */
  address_detail: string;
  /** Opsional (maks 200); `null` kalau kosong. */
  courier_note: string | null;
  /** ID area dari GET /api/shipping/areas — satu-satunya yang menentukan tarif. */
  destination_area_id: string;
  /** Label & kode pos area: hanya data tampilan untuk admin/kurir. */
  area_label: string;
  postal_code: string | null;
  courier_code: string;
  service_code: string;
  /** Ongkir & total yang DILIHAT pembeli — backend menolak order kalau
   *  hasil hitung ulangnya berbeda, bukan memakainya sebagai nominal. */
  expected_shipping_cost: number;
  expected_total: number;
  /** Asuransi pengiriman opsional (dibayar pembeli). Biaya = biaya yang
   *  DILIHAT pembeli untuk layanan terpilih; 0 kalau tidak dipilih. */
  with_insurance: boolean;
  expected_insurance_fee: number;
  items: { product_variant_id: number; quantity: number }[];
}

/** Bentuk data yang dikembalikan POST /api/orders saat sukses (envelope `{ data }`). */
export interface CreatedOrder {
  order_number: string;
  snap_token: string;
  gross_amount: number;
}

/**
 * `code` di body 422 POST /api/orders saat angka yang dilihat pembeli tidak
 * lagi cocok dengan hitung ulang backend (App\Exceptions\CheckoutQuoteChangedException).
 * Order TIDAK dibuat; halaman checkout memuat ulang tarif dan pembeli bisa
 * submit lagi dengan idempotency key yang sama.
 */
export type CheckoutQuoteErrorCode =
  | "shipping_unavailable"
  | "shipping_cost_changed"
  | "insurance_unavailable"
  | "insurance_changed"
  | "total_changed";

/**
 * Error dari POST /api/orders. `message` tetap siap tampil seperti sebelumnya;
 * `status` dan `code` (kalau backend mengirimnya) dipakai halaman checkout
 * untuk bereaksi, mis. memuat ulang tarif pada CheckoutQuoteErrorCode.
 */
export class OrderError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "OrderError";
    this.status = status;
    this.code = code;
  }
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
 * ditampilkan ke user (semua dilempar sebagai OrderError):
 * - 422 → validasi / stok tidak cukup / produk nonaktif / berat kosong
 *   (`body.message` apa adanya), atau ongkir/total berubah (`body.code` =
 *   CheckoutQuoteErrorCode)
 * - 409 → order dengan key ini masih diproses (`body.message` apa adanya)
 * - 502 → gagal menghubungi payment gateway / Biteship (`body.message` generik)
 */
export async function postOrder(payload: CreateOrderPayload): Promise<CreatedOrder> {
  const res = await fetch(apiUrl("/api/orders"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    // Coba ambil pesan + code dari body; kalau body bukan JSON, fallback ke pesan generik.
    const body = await res
      .json()
      .then((b: { message?: string; code?: string }) => b)
      .catch(() => undefined);
    const message = body?.message;

    if (
      (res.status === 422 || res.status === 409 || res.status === 502) &&
      message
    ) {
      throw new OrderError(res.status, message, body?.code);
    }
    throw new OrderError(
      res.status,
      message ?? `Gagal membuat order (HTTP ${res.status}).`,
      body?.code,
    );
  }

  const json = (await res.json()) as Envelope<CreatedOrder>;
  return json.data;
}

/** Satu area tujuan dari GET /api/shipping/areas (App\Services\Shipping\ShippingArea). */
export interface ShippingArea {
  id: string;
  /** Label lengkap siap tampil (kelurahan, kecamatan, kota, provinsi, kode pos). */
  label: string;
  postal_code: string | null;
}

/** Satu opsi tarif dari POST /api/shipping/rates (App\Services\Shipping\ShippingRate). */
export interface ShippingRate {
  courier_code: string;
  courier_name: string;
  service_code: string;
  service_name: string;
  /** Rupiah bulat. */
  cost: number;
  /** Estimasi mentah dari Biteship, mis. "1 - 2 days". */
  etd: string | null;
  description: string | null;
  /** Layanan ini bisa diasuransikan (kurir mendukung & Biteship memberi biaya). */
  insurance_available: boolean;
  /** Biaya asuransi dari Biteship, rupiah bulat — TANPA markup ongkir. 0 kalau
   *  tidak tersedia. Nilai pertanggungan = subtotal barang (meta.subtotal). */
  insurance_fee: number;
}

/** Payload POST /api/shipping/rates (lihat App\Http\Requests\ShippingRatesRequest). */
export interface ShippingRatesPayload {
  destination_area_id: string;
  items: { product_variant_id: number; quantity: number }[];
}

/**
 * `true` kalau error berasal dari AbortController (request lama dibatalkan
 * karena pembeli mengetik lagi / area berubah). Bukan kegagalan — pemanggil
 * cukup mengabaikannya, jangan tampilkan ke pembeli.
 */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Ubah response gagal endpoint ongkir jadi Error dengan pesan siap tampil.
 * Pola sama dengan postOrder: 422/502 → `body.message` dari backend (sudah
 * berbahasa Indonesia); 429 → pesan throttle sendiri karena body bawaan
 * Laravel ("Too Many Attempts.") berbahasa Inggris; lainnya → pesan generik.
 */
async function shippingError(res: Response, fallback: string): Promise<Error> {
  if (res.status === 429) {
    return new Error("Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.");
  }

  const message = await res
    .json()
    .then((body: { message?: string }) => body?.message)
    .catch(() => undefined);

  if ((res.status === 422 || res.status === 502) && message) {
    return new Error(message);
  }
  return new Error(`${fallback} (HTTP ${res.status}).`);
}

/**
 * Autocomplete area tujuan. Backend memvalidasi `q` minimal 3 karakter dan
 * meng-cache hasilnya; pemanggil tetap wajib debounce + membatalkan request
 * lama (`signal`) karena setiap cache miss memicu panggilan Biteship berbayar.
 *
 * AbortError dibiarkan lolos apa adanya (cek dengan `isAbortError`).
 */
export async function searchShippingAreas(
  q: string,
  signal?: AbortSignal,
): Promise<ShippingArea[]> {
  const res = await fetch(
    apiUrl(`/api/shipping/areas?q=${encodeURIComponent(q)}`),
    { cache: "no-store", signal },
  );

  if (!res.ok) {
    throw await shippingError(res, "Gagal mencari area");
  }

  const json = (await res.json()) as Envelope<ShippingArea[]>;
  return json.data;
}

/** Harga satu baris cart menurut backend (meta.items POST /api/shipping/rates). */
export interface ShippingQuoteItem {
  product_variant_id: number;
  /** Harga satuan efektif dari DB (price_override ?? base_price), rupiah bulat. */
  unit_price: number;
  quantity: number;
  line_total: number;
}

/**
 * Hasil POST /api/shipping/rates:
 * `{ data: ShippingRate[], meta: { service_fee, items, subtotal } }`.
 *
 * `items` & `subtotal` = harga produk TERBARU dari DB, dihitung dengan rumus
 * yang sama dengan POST /api/orders. Ringkasan checkout memakai angka ini
 * (bukan harga yang tersimpan di cart), jadi "Total Tagihan" = gross_amount.
 */
export interface ShippingQuote {
  rates: ShippingRate[];
  /** Biaya layanan per order (rupiah bulat, config SERVICE_FEE). 0 = tidak
   *  ditampilkan dan tidak ditagih. Ikut di total supaya rumusnya sama
   *  dengan backend: subtotal + ongkir + biaya layanan. */
  serviceFee: number;
  items: ShippingQuoteItem[];
  /** Rupiah bulat — identik dengan subtotal yang dihitung saat order dibuat. */
  subtotal: number;
}

/**
 * Tarif kurir ke area tujuan untuk isi cart. Sudah difilter allowlist layanan
 * dan diurutkan dari ongkir termurah oleh backend — lewat jalur yang sama
 * dengan hitung ulang di POST /api/orders. Harga & berat dihitung backend dari
 * DB — yang dikirim hanya variant id + qty.
 *
 * AbortError dibiarkan lolos apa adanya (cek dengan `isAbortError`).
 */
export async function getShippingRates(
  payload: ShippingRatesPayload,
  signal?: AbortSignal,
): Promise<ShippingQuote> {
  const res = await fetch(apiUrl("/api/shipping/rates"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    throw await shippingError(res, "Gagal mengambil ongkir");
  }

  const json = (await res.json()) as Envelope<ShippingRate[]> & {
    meta: { service_fee: number; items: ShippingQuoteItem[]; subtotal: number };
  };
  return {
    rates: json.data,
    serviceFee: json.meta.service_fee,
    items: json.meta.items,
    subtotal: json.meta.subtotal,
  };
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
