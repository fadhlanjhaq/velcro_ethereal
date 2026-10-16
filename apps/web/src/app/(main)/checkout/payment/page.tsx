"use client";

/**
 * Langkah 2 checkout: buka Snap popup Midtrans.
 *
 * Order sudah dibuat di /checkout (POST /api/orders). Halaman ini menerima
 * `order` (nomor order) + `token` (Snap token) lewat query, memuat snap.js, lalu
 * memanggil window.snap.pay(token, ...). Tidak ada UI pemilihan metode di sini —
 * semua metode aktif tampil di dalam satu popup Snap.
 *
 * onSuccess / onPending → /checkout/success?status=paid|pending. Status diambil
 * dari `transaction_status` hasil callback Snap: settlement/capture = "paid",
 * selain itu (mis. VA dipilih tapi belum ditransfer) = "pending" — supaya
 * halaman berikutnya tidak bilang "Pesanan Berhasil" padahal uang belum masuk.
 * Ini hanya untuk TAMPILAN; status pembayaran final tetap dari webhook Midtrans.
 * Untuk pending, `token` + `gross` ikut dibawa supaya halaman berikutnya bisa
 * kembali ke sini (Snap token yang sama bisa dibuka ulang selama belum
 * kedaluwarsa, default 24 jam).
 *
 * onError / onClose → tetap di sini dengan tombol untuk membuka popup lagi atau
 * kembali ke keranjang. Cart baru dibersihkan di halaman success, jadi kalau
 * user menutup popup tanpa bayar, isinya masih ada untuk dicoba lagi.
 *
 * snap.js siap → `onReady` (bukan `onLoad`): `onLoad` hanya terpicu saat script
 * PERTAMA kali dimuat di tab itu, jadi pada checkout kedua lewat navigasi
 * client-side (tanpa refresh) halaman tersangkut di "Menyiapkan pembayaran…".
 * `onReady` terpicu saat load pertama DAN setiap kali komponen dipasang ulang.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { formatRupiah } from "@/lib/api";
import { useCart } from "@/context/CartContext";

interface SnapCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: SnapCallbacks) => void };
  }
}

const SNAP_SRC =
  process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";

const CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

type Phase = "loading" | "open" | "closed" | "error";

/**
 * "paid" hanya kalau Snap melaporkan settlement / capture; selain itu pending.
 * Hasil callback Snap tidak bertipe (unknown), jadi dibaca defensif.
 */
function snapResultStatus(result: unknown): "paid" | "pending" {
  const status =
    typeof result === "object" && result !== null
      ? (result as { transaction_status?: unknown }).transaction_status
      : undefined;
  return status === "settlement" || status === "capture" ? "paid" : "pending";
}

function PaymentContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { subtotal } = useCart();

  const order = params.get("order") ?? "";
  const token = params.get("token") ?? "";
  const grossParam = params.get("gross") ?? "";

  // Total tagihan: utamakan `gross` dari query (dibawa dari /checkout, tahan
  // refresh). Fallback ke subtotal cart hanya kalau `gross` tak ada / bukan
  // angka valid (mis. link lama sebelum patch ini, atau cart sudah kosong).
  const grossFromQuery = Number(params.get("gross"));
  const displayTotal =
    Number.isFinite(grossFromQuery) && grossFromQuery > 0
      ? grossFromQuery
      : subtotal;

  const [snapReady, setSnapReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Token yang SUDAH dibuka otomatis di pemasangan ini. Per token (bukan
  // boolean) supaya popup terbuka otomatis tepat sekali per kunjungan, termasuk
  // kalau hanya query `token` yang berganti tanpa komponen dipasang ulang.
  const autoOpenedTokenRef = useRef<string | null>(null);

  const pay = useCallback(() => {
    if (!window.snap || !token) return;

    setErrorMessage(null);
    setPhase("open");

    const goToResult = (status: "paid" | "pending") => {
      const query = new URLSearchParams({ order, status });
      if (status === "pending") {
        query.set("token", token);
        if (grossParam) query.set("gross", grossParam);
      }
      router.push(`/checkout/success?${query.toString()}`);
    };

    window.snap.pay(token, {
      onSuccess: (result) => goToResult(snapResultStatus(result)),
      // onPending selalu pending, apa pun isi result-nya.
      onPending: () => goToResult("pending"),
      onError: () => {
        setPhase("error");
        setErrorMessage("Pembayaran gagal diproses.");
      },
      onClose: () => setPhase("closed"),
    });
  }, [order, token, grossParam, router]);

  // Buka popup otomatis sekali per token begitu snap.js siap.
  useEffect(() => {
    if (snapReady && token && autoOpenedTokenRef.current !== token) {
      autoOpenedTokenRef.current = token;
      pay();
    }
  }, [snapReady, token, pay]);

  if (!token) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl font-light sm:text-6xl">
          Pembayaran
        </h1>
        <p className="mt-8 text-cream/70">
          Sesi pembayaran tidak ditemukan. Mulai lagi dari halaman checkout.
        </p>
        <Link
          href="/checkout"
          className="mt-6 inline-flex rounded-full border border-gold px-8 py-3 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-ink"
        >
          Ke Checkout
        </Link>
      </div>
    );
  }

  if (!CLIENT_KEY) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl font-light sm:text-6xl">
          Pembayaran
        </h1>
        <p className="mt-8 rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-cream/90">
          Konfigurasi pembayaran belum lengkap: NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
          belum di-set. Hubungi admin.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Script
        src={SNAP_SRC}
        data-client-key={CLIENT_KEY}
        // onReady, bukan onLoad — lihat komentar di atas file.
        onReady={() => setSnapReady(true)}
        onError={() => {
          setPhase("error");
          setErrorMessage(
            "Gagal memuat modul pembayaran. Periksa koneksi lalu coba lagi.",
          );
        }}
      />

      <h1 className="font-serif text-4xl font-light sm:text-6xl">Pembayaran</h1>

      <div className="mt-8 rounded-sm border border-cream/10 bg-ink-soft px-6 py-5">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-cream/50">
            Nomor Order
          </span>
          <span className="font-serif text-lg font-medium tabular-nums text-gold">
            {order || "—"}
          </span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-cream/10 pt-4">
          <span className="text-sm text-cream/70">Total tagihan</span>
          <span className="font-serif text-2xl font-medium text-gold">
            {formatRupiah(String(displayTotal))}
          </span>
        </div>
      </div>

      {phase === "loading" && (
        <p className="mt-6 text-sm text-cream/70">Menyiapkan pembayaran…</p>
      )}

      {phase === "open" && (
        <div className="mt-6">
          <p className="text-sm text-cream/70">
            Jendela pembayaran Midtrans sedang terbuka. Selesaikan pembayaran di
            sana.
          </p>
          <button
            type="button"
            onClick={pay}
            className="mt-4 text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-gold"
          >
            Jendela tidak muncul? Buka lagi
          </button>
        </div>
      )}

      {phase === "closed" && (
        <div className="mt-6">
          <p className="rounded-sm border border-gold/25 bg-gold/5 px-4 py-3 text-sm leading-relaxed text-cream/80">
            Pembayaran belum selesai.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={pay}
              className="rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-dark"
            >
              Buka lagi
            </button>
            <Link
              href="/cart"
              className="text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-gold"
            >
              ← Kembali ke keranjang
            </Link>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="mt-6">
          <p
            role="alert"
            className="rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-cream/90"
          >
            {errorMessage ?? "Terjadi kesalahan pada pembayaran."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={pay}
              className="rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-dark"
            >
              Coba lagi
            </button>
            <Link
              href="/cart"
              className="text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-gold"
            >
              ← Kembali ke keranjang
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
      <Suspense fallback={null}>
        <PaymentContent />
      </Suspense>
    </main>
  );
}
