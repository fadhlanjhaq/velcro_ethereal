"use client";

/**
 * SIMULASI — panel harga + pilih ukuran + Tambah ke Keranjang.
 * Tombol "Tambah ke Keranjang" mengisi CartContext in-memory (Milestone 6,
 * Bagian C) — murni simulasi frontend untuk demo, TIDAK menyimpan order ke
 * backend / tidak terhubung ke payment gateway. Isi cart hilang saat refresh.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { formatRupiah, type Product } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function ProductPurchasePanel({
  product,
}: {
  product: Product;
}) {
  const { addItem } = useCart();
  const { variants } = product;

  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allOutOfStock = variants.every((v) => v.stock <= 0);
  const selectedVariant =
    variants.find((v) => v.sku === selectedSku) ?? null;

  function handleAdd() {
    if (!selectedVariant) return; // ukuran wajib dipilih dulu
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      size: selectedVariant.size,
      sku: selectedVariant.sku,
      basePrice: product.base_price,
      image: product.images[0]?.url ?? null,
    });
    setAdded(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setAdded(false), 3000);
  }

  return (
    <div>
      <p className="font-serif text-3xl font-medium text-gold">
        {formatRupiah(product.base_price)}
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
        onClick={handleAdd}
        disabled={allOutOfStock || !selectedVariant}
        className={[
          "mt-10 w-full rounded-full px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] transition-colors sm:w-auto",
          allOutOfStock || !selectedVariant
            ? "cursor-not-allowed border border-cream/20 text-cream/40"
            : "bg-gold text-ink hover:bg-gold-dark",
        ].join(" ")}
      >
        {allOutOfStock ? "Stok Habis" : "Tambah ke Keranjang"}
      </button>

      {!selectedVariant && !allOutOfStock && (
        <p className="mt-3 text-xs text-cream/40">
          Pilih ukuran terlebih dahulu.
        </p>
      )}

      {added && (
        <p
          role="status"
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-cream/80"
        >
          <span className="text-gold">✓ Ditambahkan ke keranjang.</span>
          <Link
            href="/cart"
            className="underline decoration-cream/30 underline-offset-4 transition-colors hover:text-gold"
          >
            Lihat keranjang →
          </Link>
        </p>
      )}
    </div>
  );
}
