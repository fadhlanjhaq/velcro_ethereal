"use client";

/**
 * SIMULASI — tidak terhubung ke backend/payment gateway sungguhan.
 * Dibangun untuk keperluan demo/pitching ke client (Milestone 6, Bagian C).
 *
 * Tampilan meniru pilihan pembayaran ala Midtrans Snap, TAPI TIDAK ada logic
 * pembayaran asli: memilih metode + klik lanjut hanya berpindah step. QR pada
 * mode QRIS meng-encode string dummy ("SIMULATED-ORDER-DO-NOT-SCAN") dan TIDAK
 * bisa (dan tidak boleh) dipindai untuk transaksi nyata.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { formatRupiah } from "@/lib/api";
import { generateOrderNumber } from "@/lib/order";
import { useCart } from "@/context/CartContext";

type Method = "va" | "ewallet" | "qris" | "card";

const METHODS: { id: Method; label: string; desc: string }[] = [
  { id: "va", label: "Virtual Account", desc: "BCA, BNI, Mandiri, dll." },
  { id: "ewallet", label: "E-Wallet", desc: "GoPay, OVO, DANA, ShopeePay" },
  { id: "qris", label: "QRIS", desc: "Pindai dengan aplikasi apa pun" },
  { id: "card", label: "Kartu Kredit", desc: "Visa, Mastercard, JCB" },
];

const QRIS_SECONDS = 15 * 60; // 15:00 hitung mundur

export default function PaymentPage() {
  const router = useRouter();
  const { items, subtotal } = useCart();
  const [method, setMethod] = useState<Method | null>(null);
  const [stage, setStage] = useState<"select" | "qris">("select");
  const [secondsLeft, setSecondsLeft] = useState(QRIS_SECONDS);

  // Countdown hanya berjalan saat menampilkan QRIS.
  useEffect(() => {
    if (stage !== "qris") return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  if (items.length === 0) {
    return (
      <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-serif text-4xl font-light sm:text-6xl">
            Pembayaran
          </h1>
          <p className="mt-8 text-cream/70">Tidak ada pesanan untuk dibayar.</p>
          <Link
            href="/shop"
            className="mt-6 inline-flex rounded-full border border-gold px-8 py-3 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-ink"
          >
            Jelajahi Koleksi
          </Link>
        </div>
      </main>
    );
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  // Nomor order digenerate saat "membayar" dan dibawa ke halaman sukses lewat
  // query param (deterministik antar SSR/hydrate, tanpa setState-in-effect).
  function goToSuccess() {
    router.push(`/checkout/success?order=${generateOrderNumber()}`);
  }

  return (
    <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-serif text-4xl font-light sm:text-6xl">
          Pembayaran
        </h1>
        <div className="mt-6 flex items-baseline justify-between border-y border-cream/10 py-4">
          <span className="text-sm text-cream/70">Total tagihan</span>
          <span className="font-serif text-2xl font-medium text-gold">
            {formatRupiah(String(subtotal))}
          </span>
        </div>

        <p className="mt-6 rounded-sm border border-gold/25 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-cream/70">
          Mode simulasi — semua metode pembayaran di bawah hanya peragaan untuk
          demo. Tidak ada transaksi nyata yang diproses.
        </p>

        {stage === "select" ? (
          <>
            <div
              role="radiogroup"
              aria-label="Metode pembayaran"
              className="mt-8 flex flex-col gap-3"
            >
              {METHODS.map((m) => {
                const selected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMethod(m.id)}
                    className={[
                      "flex items-center justify-between rounded-sm border px-5 py-4 text-left transition-colors",
                      selected
                        ? "border-gold bg-gold/10"
                        : "border-cream/20 hover:border-cream/40",
                    ].join(" ")}
                  >
                    <span>
                      <span className="block text-sm font-medium">
                        {m.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-cream/50">
                        {m.desc}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={[
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        selected ? "border-gold" : "border-cream/30",
                      ].join(" ")}
                    >
                      {selected && (
                        <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!method}
              onClick={() => {
                if (method === "qris") {
                  setStage("qris");
                } else {
                  goToSuccess();
                }
              }}
              className={[
                "mt-8 w-full rounded-full px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] transition-colors",
                method
                  ? "bg-gold text-ink hover:bg-gold-dark"
                  : "cursor-not-allowed border border-cream/20 text-cream/40",
              ].join(" ")}
            >
              {method === "qris" ? "Tampilkan QRIS" : "Bayar Sekarang"}
            </button>
          </>
        ) : (
          <div className="mt-8 flex flex-col items-center">
            <p className="text-sm text-cream/70">
              Pindai QR di bawah untuk membayar
            </p>

            <div className="mt-6 rounded-lg bg-cream p-5">
              <QRCodeSVG
                value="SIMULATED-ORDER-DO-NOT-SCAN"
                size={200}
                bgColor="#F3EDE1"
                fgColor="#1C1712"
                level="M"
              />
            </div>

            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-cream/40">
              QR simulasi — jangan dipindai
            </p>

            <div className="mt-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-cream/50">
                Bayar dalam
              </p>
              <p className="mt-1 font-serif text-3xl font-medium tabular-nums text-gold">
                {minutes}:{seconds}
              </p>
            </div>

            <button
              type="button"
              onClick={goToSuccess}
              className="mt-8 w-full rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:bg-gold-dark"
            >
              Saya Sudah Bayar
            </button>
            <button
              type="button"
              onClick={() => setStage("select")}
              className="mt-4 text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-gold"
            >
              ← Ganti metode
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
