"use client";

/**
 * Langkah 3 checkout: konfirmasi setelah Snap popup selesai (sukses / pending).
 *
 * Nomor order asli dibawa dari halaman pembayaran lewat query param `?order=`
 * (berasal dari POST /api/orders). Cart baru dibersihkan DI SINI — bukan saat
 * order dibuat — supaya user yang menutup popup tanpa bayar masih punya isi cart
 * untuk mengulang. Status pembayaran final ditentukan backend lewat webhook
 * Midtrans, bukan halaman ini.
 *
 * `?status=paid` (Snap melaporkan settlement/capture) → "Pesanan Berhasil!".
 * Selain itu — termasuk parameter tidak ada — → "Menunggu Pembayaran": lebih
 * aman menganggap belum dibayar daripada bilang berhasil padahal uang belum
 * masuk (mis. VA dipilih tapi belum ditransfer).
 *
 * Varian pending punya tombol "Lanjutkan Pembayaran" (hanya kalau `token` ada
 * di URL) → kembali ke /checkout/payment dengan token yang SAMA, sehingga popup
 * Snap terbuka lagi. Docs Midtrans menjamin token boleh dibuka ulang selama
 * belum kedaluwarsa (default 24 jam) dan menyebut tampilan ulang untuk
 * e-wallet/QRIS. ASUMSI: untuk VA/transfer bank, Snap juga menampilkan lagi
 * instruksi/nomor VA yang sudah dipilih — belum terdokumentasi, perlu dicek di
 * sandbox. Tidak menjanjikan email konfirmasi (email belum dikonfigurasi).
 */

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";

function SuccessContent() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "—";
  const isPaid = params.get("status") === "paid";
  const token = params.get("token");
  // Link balik ke halaman pembayaran (token sama → popup Snap terbuka lagi).
  const resumeHref = token
    ? `/checkout/payment?${new URLSearchParams({
        order: params.get("order") ?? "",
        token,
        gross: params.get("gross") ?? "",
      }).toString()}`
    : null;
  const { clearCart } = useCart();

  // Reset keranjang begitu sampai di halaman ini (= popup Snap selesai
  // sukses/pending). Sengaja bukan di /checkout/payment supaya cart tetap ada
  // kalau user menutup popup tanpa membayar.
  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="flex max-w-md flex-col items-center">
      <span
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full border border-gold text-2xl text-gold"
      >
        {isPaid ? (
          "✓"
        ) : (
          // Ikon jam — pembayaran belum diterima.
          <svg
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
        )}
      </span>

      {isPaid ? (
        <>
          <h1 className="mt-8 font-serif text-4xl font-light sm:text-5xl">
            Pesanan Berhasil!
          </h1>
          <p className="mt-4 leading-relaxed text-cream/70">
            Terima kasih. Pesananmu telah kami terima dan sedang kami siapkan.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-8 font-serif text-4xl font-light sm:text-5xl">
            Menunggu Pembayaran
          </h1>
          <p className="mt-4 leading-relaxed text-cream/70">
            Pesananmu sudah tercatat. Selesaikan pembayaran sesuai instruksi
            sebelum batas waktu. Pesanan diproses setelah pembayaran kami
            terima.
          </p>
        </>
      )}

      <div className="mt-8 w-full rounded-sm border border-cream/10 bg-ink-soft px-6 py-5">
        <p className="text-xs uppercase tracking-[0.3em] text-cream/50">
          Nomor Order
        </p>
        <p className="mt-2 font-serif text-2xl font-medium tabular-nums text-gold">
          {orderNumber}
        </p>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-cream/40">
        Simpan nomor order ini. Status pembayaran diperbarui otomatis begitu
        Midtrans mengonfirmasi transaksi.
      </p>

      {!isPaid && resumeHref && (
        <div className="mt-10 flex flex-col items-center">
          <Link
            href={resumeHref}
            className="inline-flex rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-dark"
          >
            Lanjutkan Pembayaran
          </Link>
          <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-cream/50">
            Gunakan tombol ini untuk melihat kembali instruksi pembayaran
            selama batas waktu pembayaran belum lewat.
          </p>
        </div>
      )}

      {/* Saat ada tombol "Lanjutkan Pembayaran", belanja lagi jadi aksi kedua
          (outline) supaya tidak ada dua tombol utama yang bersaing. */}
      <Link
        href="/shop"
        className={[
          "inline-flex rounded-full px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] transition-colors",
          !isPaid && resumeHref
            ? "mt-6 border border-gold text-cream hover:bg-gold hover:text-ink"
            : "mt-10 bg-gold text-ink hover:bg-gold-dark",
        ].join(" ")}
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
