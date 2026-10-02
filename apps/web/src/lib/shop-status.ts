/**
 * Saklar tunggal untuk membuka/menutup jalur belanja (shop, cart, checkout).
 * Shop dianggap TUTUP kecuali NEXT_PUBLIC_SHOP_OPEN persis "true" — default
 * aman selama integrasi Midtrans belum siap. NEXT_PUBLIC_* di-inline saat
 * build (lihat Dockerfile), jadi mengubahnya butuh rebuild image.
 *
 * Dibaca dari proxy.ts (mengunci route) dan komponen UI (mengganti link) agar
 * keduanya selalu sepakat. Tanpa import server-only supaya aman dipakai di
 * Client Component.
 */
export const SHOP_OPEN = process.env.NEXT_PUBLIC_SHOP_OPEN === "true";

/** Tujuan semua jalur belanja selama shop tutup. */
export const SHOP_CLOSED_PATH = "/shop-segera";

export const SHOP_CLOSED_MESSAGE =
  "Halaman shop sedang dalam pengembangan. Segera hadir.";

/** Path yang dikunci saat shop tutup. Exact match agar /shop-segera lolos. */
export function isShopPath(pathname: string): boolean {
  return (
    pathname === "/shop" ||
    pathname.startsWith("/shop/") ||
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname.startsWith("/checkout/")
  );
}
