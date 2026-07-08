"use client";

import { useState } from "react";
import { formatRupiah, type ProductVariant } from "@/lib/api";

/**
 * Panel harga + pilihan ukuran + tombol keranjang untuk halaman detail produk.
 * Client island kecil (state pilihan ukuran) supaya page detail tetap Server
 * Component. Ukuran dengan stok 0 di-disable. Tombol "Tambah ke Keranjang"
 * sengaja DISABLED berlabel jujur "Segera Hadir" — cart/checkout belum ada
 * (milestone terpisah), jadi tidak ada tombol yang terlihat berfungsi padahal
 * belum. Pemilihan ukuran murni UI lokal, belum terhubung ke apa pun.
 */
export default function ProductPurchasePanel({
  basePrice,
  variants,
}: {
  basePrice: string;
  variants: ProductVariant[];
}) {
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const allOutOfStock = variants.every((v) => v.stock <= 0);

  return (
    <div>
      <p className="font-serif text-3xl font-medium text-gold">
        {formatRupiah(basePrice)}
      </p>

      {variants.length > 0 && (
        <div className="mt-10">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-cream/60">
            Ukuran
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {variants.map((variant) => {
              const soldOut = variant.stock <= 0;
              const selected = variant.sku === selectedSku;
              return (
                <button
                  key={variant.sku}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={selected}
                  onClick={() => setSelectedSku(variant.sku)}
                  className={[
                    "relative min-w-14 rounded-sm border px-4 py-3 text-sm font-medium transition-colors",
                    soldOut
                      ? "cursor-not-allowed border-cream/15 text-cream/30 line-through"
                      : selected
                        ? "border-gold bg-gold text-ink"
                        : "border-cream/30 text-cream hover:border-gold",
                  ].join(" ")}
                  title={soldOut ? "Stok habis" : `Stok: ${variant.stock}`}
                >
                  {variant.size}
                </button>
              );
            })}
          </div>
          {allOutOfStock && (
            <p className="mt-3 text-sm text-cream/50">
              Semua ukuran sedang habis.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        disabled
        className="mt-10 w-full cursor-not-allowed rounded-full border border-cream/20 px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] text-cream/40 sm:w-auto"
      >
        Segera Hadir
      </button>
      <p className="mt-3 text-xs text-cream/40">
        Keranjang & checkout belum tersedia.
      </p>
    </div>
  );
}
