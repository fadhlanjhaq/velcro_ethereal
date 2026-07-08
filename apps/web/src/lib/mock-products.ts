/**
 * Mock data produk — SEMENTARA, menunggu API asli (Milestone 5).
 *
 * Shape di file ini sengaja meniru PERSIS payload yang akan dikembalikan API
 * Laravel (mengacu Product / ProductVariant / ProductImage dari Milestone 3):
 *   - penamaan snake_case (name, base_price, sort_order, ...) seperti default
 *     serialisasi Eloquent, bukan camelCase.
 *   - `base_price` bertipe string ("850000.00") karena kolomnya `decimal:2`
 *     yang oleh Laravel di-serialize sebagai string di JSON — bukan number.
 *   - relasi `category`, `variants`, `images` sebagai nested object/array.
 * Tujuannya: saat swap ke fetch API asli nanti, komponen tidak perlu diubah —
 * cukup ganti sumber datanya.
 *
 * Isi data (nama, story, description, harga placeholder, SKU, ukuran, stok)
 * disalin identik dari HeritageCollectionSeeder (apps/api). `base_price`
 * Rp 850.000 adalah PLACEHOLDER yang sama seperti di seeder — harga asli
 * menyusul dari client.
 *
 * CATATAN ASET FOTO (penting, jangan tersembunyi):
 *   Dari 4 produk Heritage Collection, hanya "Aureus Peacock Jacket" yang punya
 *   foto asli (aset menampilkan jaket bordir merak emas + tampak depan). Tiga
 *   produk lain (Aurelia/Verdant Knotwork, Cervus Grove) BELUM punya foto —
 *   foto yang dipakai di sini adalah PLACEHOLDER dari aset lain (a.l. koleksi
 *   "Seafarer Wave Knit" yang bukan bagian Heritage) semata untuk mengisi layout
 *   prototipe. Ganti dengan product photography asli sebelum rilis.
 */

export interface MockCategory {
  id: number;
  name: string;
  slug: string;
}

export interface MockProductVariant {
  size: string;
  sku: string;
  stock: number;
}

export interface MockProductImage {
  url: string;
  sort_order: number;
}

export interface MockProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  story: string;
  /** decimal:2 → string di JSON Laravel, mis. "850000.00" */
  base_price: string;
  category: MockCategory;
  images: MockProductImage[];
  variants: MockProductVariant[];
}

/** PLACEHOLDER — identik dengan HeritageCollectionSeeder::PLACEHOLDER_BASE_PRICE. */
const PLACEHOLDER_BASE_PRICE = "850000.00";

const SIZES = ["S", "M", "L", "XL"] as const;

const JAKET: MockCategory = { id: 2, name: "Jaket", slug: "jaket" };

/** Bikin 4 varian ukuran (S/M/L/XL) dengan SKU `VE-{inisial}-{ukuran}`, stok 10. */
function buildVariants(skuInitials: string): MockProductVariant[] {
  return SIZES.map((size) => ({
    size,
    sku: `VE-${skuInitials}-${size}`,
    stock: 10,
  }));
}

function buildImages(urls: string[]): MockProductImage[] {
  return urls.map((url, index) => ({ url, sort_order: index }));
}

export const mockProducts: MockProduct[] = [
  {
    id: 1,
    name: "Aurelia Knotwork Jacket",
    slug: "aurelia-knotwork-jacket",
    description:
      "Jaket dengan colorway Beige Brown, dihiasi bordir motif simpul keemasan.",
    story: "Jaket bordir simpul keemasan yang mewah",
    base_price: PLACEHOLDER_BASE_PRICE,
    category: JAKET,
    // PLACEHOLDER — belum ada foto Aurelia Knotwork asli.
    images: buildImages(["/images/product/asset_04.jpg"]),
    variants: buildVariants("AKJ"),
  },
  {
    id: 2,
    name: "Verdant Knotwork Jacket",
    slug: "verdant-knotwork-jacket",
    description:
      "Jaket dengan colorway Forest Green, dihiasi bordir motif simpul hijau.",
    story: "Jaket bordir simpul hijau yang melambangkan kehidupan",
    base_price: PLACEHOLDER_BASE_PRICE,
    category: JAKET,
    // PLACEHOLDER — belum ada foto Verdant Knotwork asli.
    images: buildImages(["/images/product/asset_05.jpg"]),
    variants: buildVariants("VKJ"),
  },
  {
    id: 3,
    name: "Cervus Grove Jacket",
    slug: "cervus-grove-jacket",
    description: "Jaket bermotif rusa (cervus), terinspirasi hutan kecil yang sakral.",
    story: "Cervus (rusa) — terinspirasi hutan kecil yang sakral",
    base_price: PLACEHOLDER_BASE_PRICE,
    category: JAKET,
    // PLACEHOLDER — belum ada foto Cervus Grove asli.
    images: buildImages(["/images/product/asset_07.jpg"]),
    variants: buildVariants("CGJ"),
  },
  {
    id: 4,
    name: "Aureus Peacock Jacket",
    slug: "aureus-peacock-jacket",
    description: "Jaket bermotif burung merak (aureus/emas), terinspirasi keindahannya.",
    story: "Aureus (emas) — terinspirasi keindahan burung merak",
    base_price: PLACEHOLDER_BASE_PRICE,
    category: JAKET,
    // FOTO ASLI — bordir merak emas (back) + tampak depan.
    images: buildImages([
      "/images/brand/asset_02.jpg",
      "/images/product/asset_01.jpg",
      "/images/product/asset_03.jpg",
    ]),
    variants: buildVariants("APJ"),
  },
];

/** Format harga (string decimal) → Rupiah, mis. "850000.00" → "Rp 850.000". */
export function formatRupiah(basePrice: string): string {
  const value = Number.parseFloat(basePrice);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
