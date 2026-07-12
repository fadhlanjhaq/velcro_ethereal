"use client";

/**
 * SIMULASI — tidak terhubung ke backend/payment gateway sungguhan.
 * Dibangun untuk keperluan demo/pitching ke client (Milestone 6, Bagian C).
 *
 * Nomor order dibuat di halaman pembayaran (timestamp + random) dan dibawa ke
 * sini lewat query param `?order=` — BUKAN dari database, tidak ada order yang
 * benar-benar tersimpan. Cart di-reset saat halaman ini termuat.
 */

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";

function SuccessContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "—";
  const { clearCart } = useCart();

  // Reset keranjang setelah "pembayaran" simulasi selesai.
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="flex max-w-md flex-col items-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full border border-gold text-2xl text-gold"
      >
        ✓
      </span>

      <h1 className="mt-8 font-serif text-4xl font-light sm:text-5xl">
        Pesanan Berhasil!
      </h1>
      <p className="mt-4 leading-relaxed text-cream/70">
        Terima kasih. Pesananmu telah kami terima dan sedang kami siapkan.
      </p>

      <div className="mt-8 w-full rounded-sm border border-cream/10 bg-ink-soft px-6 py-5">
        <p className="text-xs uppercase tracking-[0.3em] text-cream/50">
          Nomor Order
        </p>
        <p className="mt-2 font-serif text-2xl font-medium tabular-nums text-gold">
          {orderNumber}
        </p>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-cream/40">
        Simulasi demo — nomor order ini dibuat acak dan tidak tersimpan di
        database mana pun.
      </p>

      <Link
        href="/shop"
        className="mt-10 inline-flex rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-dark"
      >
        Lanjut Belanja
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-ink px-6 pb-24 pt-28 text-center text-cream sm:pt-36">
      <Suspense fallback={null}>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
