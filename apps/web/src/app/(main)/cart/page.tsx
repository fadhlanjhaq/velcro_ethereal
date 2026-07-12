"use client";

/**
 * SIMULASI — tidak terhubung ke backend/payment gateway sungguhan.
 * Dibangun untuk keperluan demo/pitching ke client (Milestone 6, Bagian C).
 * Cart in-memory: isinya hilang saat halaman di-refresh (disengaja).
 */

import Image from "next/image";
import Link from "next/link";
import { formatRupiah } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import PhotoFallback from "@/components/shop/PhotoFallback";

export default function CartPage() {
  const { items, subtotal, count, updateQty, removeItem } = useCart();

  return (
    <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif text-4xl font-light sm:text-6xl">Keranjang</h1>

        {items.length === 0 ? (
          <div className="mt-12 border-t border-cream/10 pt-12">
            <p className="text-cream/70">Keranjang kamu masih kosong.</p>
            <Link
              href="/shop"
              className="mt-6 inline-flex rounded-full border border-gold px-8 py-3 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-ink"
            >
              Jelajahi Koleksi
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem]">
            {/* Daftar item */}
            <ul className="flex flex-col divide-y divide-cream/10 border-y border-cream/10">
              {items.map((item) => (
                <li key={item.sku} className="flex gap-5 py-6">
                  <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-sm bg-ink-soft">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <PhotoFallback label="" />
                    )}
                  </div>

                  <div className="flex flex-1 flex-col">
                    <div className="flex justify-between gap-4">
                      <div>
                        <Link
                          href={`/shop/${item.slug}`}
                          className="font-serif text-lg font-medium transition-colors hover:text-gold"
                        >
                          {item.name}
                        </Link>
                        <p className="mt-1 text-sm text-cream/60">
                          Ukuran {item.size}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-gold">
                        {formatRupiah(item.basePrice)}
                      </p>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-4">
                      {/* Kontrol qty */}
                      <div className="flex items-center rounded-sm border border-cream/20">
                        <button
                          type="button"
                          onClick={() => updateQty(item.sku, item.qty - 1)}
                          disabled={item.qty <= 1}
                          aria-label="Kurangi jumlah"
                          className="px-3 py-1.5 text-cream/80 transition-colors hover:text-gold disabled:cursor-not-allowed disabled:text-cream/25"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.sku, item.qty + 1)}
                          aria-label="Tambah jumlah"
                          className="px-3 py-1.5 text-cream/80 transition-colors hover:text-gold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.sku)}
                        className="text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-gold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Ringkasan */}
            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <div className="rounded-sm border border-cream/10 bg-ink-soft p-6">
                <div className="flex justify-between text-sm">
                  <span className="text-cream/70">
                    Subtotal ({count} item)
                  </span>
                  <span className="font-medium">
                    {formatRupiah(String(subtotal))}
                  </span>
                </div>
                <p className="mt-2 text-xs text-cream/50">
                  Ongkir dihitung di langkah berikutnya.
                </p>
                <Link
                  href="/checkout"
                  className="mt-6 block rounded-full bg-gold px-8 py-3.5 text-center text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-dark"
                >
                  Checkout
                </Link>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-cream/40">
                Simulasi demo — keranjang tidak tersimpan permanen dan akan
                kosong setelah halaman di-refresh.
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
