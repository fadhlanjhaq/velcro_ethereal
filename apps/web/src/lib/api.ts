/**
 * Klien data produk — sumber kebenaran runtime (menggantikan lib/mock-products.ts).
 *
 * Tipe di-reuse dari mock-products.ts via `import type` (hanya tipe, dihapus saat
 * compile) supaya tidak ada data mock yang ikut ter-bundle di runtime — mock
 * hanya bertahan sebagai referensi bentuk data. Bentuk payload API (App\Http\
 * Resources\* di apps/api) sudah dibuat PERSIS sama dengan interface ini.
 */
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
