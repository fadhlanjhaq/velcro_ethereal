"use client";

/**
 * Langkah 1 checkout: kumpulkan data penerima + pilih metode pengiriman, lalu
 * serahkan isi cart ke backend.
 *
 * Submit → POST /api/orders (lib/api.ts `postOrder`): backend membuat order dari
 * item cart, mengambil harga/nama dari DB, dan meminta Snap token Midtrans.
 * Kalau sukses, lanjut ke /checkout/payment dengan `order` + `token` di query;
 * kalau gagal, pesan error dari backend ditampilkan di sini dan halaman tidak
 * berpindah (cart tetap utuh untuk dicoba lagi).
 *
 * Ongkir (Biteship): area tujuan dipilih lewat autocomplete
 * (GET /api/shipping/areas), lalu tarif kurir ASLI diambil dari
 * POST /api/shipping/rates untuk isi cart (sudah difilter allowlist layanan,
 * termasuk markup toko, & diurutkan termurah oleh backend).
 *
 * Ringkasan memakai angka BACKEND begitu tarif termuat: harga per item &
 * subtotal dari `meta.items` / `meta.subtotal` (harga DB terbaru, rumus yang
 * sama dengan POST /api/orders), dan harga di cart ikut disinkronkan
 * (`syncPrices`). Total = meta.subtotal + ongkir + biaya layanan
 * (`meta.service_fee`, barisnya tidak tampil kalau 0) — sama dengan
 * gross_amount, jadi harga lama di cart tidak bisa membuat order ditolak terus.
 *
 * Submit mengirim area, layanan terpilih, serta ongkir & total yang DILIHAT
 * pembeli (`expected_*`). Backend menghitung ulang lewat jalur tarif yang
 * sama; kalau hasilnya berbeda, order ditolak 422 dengan `code`
 * (shipping_unavailable / shipping_cost_changed / total_changed) dan TIDAK
 * dibuat. Halaman ini lalu menampilkan pesannya dan memuat ulang tarif —
 * yang sekaligus menyegarkan harga produk, ongkir, dan ringkasan — dan pembeli
 * cukup submit sekali lagi dengan idempotency key yang sama. Lihat
 * docs/decisions/shipping-biteship.md.
 */

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  formatRupiah,
  getShippingRates,
  isAbortError,
  OrderError,
  postOrder,
  searchShippingAreas,
  type ShippingArea,
  type ShippingQuoteItem,
  type ShippingRate,
} from "@/lib/api";
import { useCart } from "@/context/CartContext";

const ICON = {
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  bolt: "M13 10V3L4 14h7v7l9-11h-7z",
  check: "M5 13l4 4L19 7",
  shield:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
} as const;

// Sama dengan rule `min:3` backend — di bawah itu backend membalas 422, jadi
// tidak perlu dikirim sama sekali.
const AREA_MIN_CHARS = 3;
// Tiap cache miss di backend = satu panggilan Biteship berbayar; tunggu
// pembeli berhenti mengetik dulu (saran docs Biteship).
const AREA_DEBOUNCE_MS = 400;
const COURIER_NOTE_MAX = 200;
// Sama dengan rule `address_detail` max:500 di StoreOrderRequest.
const ADDRESS_DETAIL_MAX = 500;

// Code 422 POST /api/orders yang berarti "angka yang dilihat pembeli sudah
// basi" — tarif dimuat ulang supaya pembeli bisa memilih & submit lagi.
const QUOTE_ERROR_CODES = new Set([
  "shipping_unavailable",
  "shipping_cost_changed",
  "total_changed",
]);

// Badge 3 huruf di kartu kurir. Kode di luar daftar → 3 huruf pertama kapital.
const COURIER_BADGES: Record<string, string> = {
  jne: "JNE",
  jnt: "J&T",
  sicepat: "SCP",
};

type RatesResult =
  | {
      key: string;
      rates: ShippingRate[];
      serviceFee: number;
      items: ShippingQuoteItem[];
      subtotal: number;
      error: null;
    }
  | {
      key: string;
      rates: null;
      serviceFee: null;
      items: null;
      subtotal: null;
      error: string;
    };

type RatesStatus = "idle" | "loading" | "error" | "success";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, count, syncPrices } = useCart();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressDetail: "",
    courierNote: "",
  });
  const [selectedArea, setSelectedArea] = useState<ShippingArea | null>(null);
  // Pilihan EKSPLISIT pembeli. Kalau null atau sudah tidak ada di tarif
  // terbaru, layanan termurah yang dipakai (lihat `selectedRate`).
  const [chosenRateId, setChosenRateId] = useState<string | null>(null);
  const [ratesResult, setRatesResult] = useState<RatesResult | null>(null);
  // Dinaikkan oleh tombol "Coba lagi" dan oleh error quote dari POST
  // /api/orders → key berubah → tarif diambil ulang (state lama dilewati).
  const [ratesRetry, setRatesRetry] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Satu idempotency key per page load (lazy initializer → tidak di-generate
  // ulang tiap render). Retry submit setelah gagal mengirim key yang SAMA
  // supaya backend men-dedup. Reload halaman = key baru = percobaan baru.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Identitas isi cart untuk cek ongkir (variant id + qty, diurutkan) dalam
  // bentuk string, supaya effect hanya jalan ulang kalau isinya benar-benar
  // berubah — bukan setiap kali array `items` dibuat ulang.
  const rateItemsKey = useMemo(
    () =>
      JSON.stringify(
        items
          .map((item) => ({
            product_variant_id: item.productVariantId,
            quantity: item.qty,
          }))
          .sort((a, b) => a.product_variant_id - b.product_variant_id),
      ),
    [items],
  );

  const selectedAreaId = selectedArea?.id ?? null;
  const ratesKey =
    selectedAreaId && items.length > 0
      ? `${selectedAreaId}|${rateItemsKey}|${ratesRetry}`
      : null;

  // Ambil tarif setiap kali area / isi cart berubah (atau "Coba lagi").
  // Request lama dibatalkan. State "memuat" tidak disimpan terpisah: hasil
  // dicatat bersama key-nya, jadi selama key hasil ≠ key sekarang = memuat.
  useEffect(() => {
    if (!selectedAreaId || rateItemsKey === "[]") return;

    const key = `${selectedAreaId}|${rateItemsKey}|${ratesRetry}`;
    const controller = new AbortController();

    getShippingRates(
      {
        destination_area_id: selectedAreaId,
        items: JSON.parse(rateItemsKey),
      },
      controller.signal,
    )
      .then(({ rates, serviceFee, items: quoteItems, subtotal }) => {
        setRatesResult({
          key,
          rates,
          serviceFee,
          items: quoteItems,
          subtotal,
          error: null,
        });
        // Harga di cart disegarkan dari DB supaya /cart dan ringkasan tidak
        // menampilkan harga lama. Hanya mengubah harga (bukan variant/qty),
        // jadi rateItemsKey tetap sama dan effect ini tidak terpicu ulang.
        syncPrices(
          Object.fromEntries(
            quoteItems.map((i) => [i.product_variant_id, i.unit_price]),
          ),
        );
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setRatesResult({
          key,
          rates: null,
          serviceFee: null,
          items: null,
          subtotal: null,
          error:
            err instanceof Error ? err.message : "Gagal mengambil ongkir.",
        });
      });

    return () => controller.abort();
  }, [selectedAreaId, rateItemsKey, ratesRetry, syncPrices]);

  let ratesStatus: RatesStatus = "idle";
  let rates: ShippingRate[] = [];
  let ratesError: string | null = null;
  // Hanya diketahui setelah tarif sukses dimuat (dikirim di meta yang sama).
  let serviceFee = 0;
  // Angka backend untuk ringkasan; null selama belum ada tarif sukses (ringkasan
  // memakai harga cart sebagai perkiraan, dan submit memang belum bisa).
  let quoteSubtotal: number | null = null;
  let quoteLineTotals: Map<number, number> | null = null;

  if (ratesKey) {
    if (!ratesResult || ratesResult.key !== ratesKey) {
      ratesStatus = "loading";
    } else if (ratesResult.error !== null) {
      ratesStatus = "error";
      ratesError = ratesResult.error;
    } else {
      ratesStatus = "success";
      rates = ratesResult.rates;
      serviceFee = ratesResult.serviceFee;
      quoteSubtotal = ratesResult.subtotal;
      quoteLineTotals = new Map(
        ratesResult.items.map((i) => [i.product_variant_id, i.line_total]),
      );
    }
  }

  const { cheapestId, fastestId } = pickHighlights(rates);
  const selectedRate =
    rates.find((r) => rateId(r) === chosenRateId) ??
    rates.find((r) => rateId(r) === cheapestId) ??
    null;
  const selectedRateId = selectedRate ? rateId(selectedRate) : null;

  const shippingCost = selectedRate?.cost ?? 0;
  const displaySubtotal = quoteSubtotal ?? Number(subtotal);
  // Rumus sama dengan gross_amount backend: subtotal backend + ongkir + biaya
  // layanan (ketiganya rupiah bulat). Ini yang dikirim sebagai expected_total.
  const total = displaySubtotal + shippingCost + serviceFee;

  // Alasan pertama yang menahan tombol submit — ditampilkan sebagai teks bantu.
  let blockReason: string | null = null;
  if (!selectedArea) {
    blockReason = "Pilih area tujuan dari daftar terlebih dahulu.";
  } else if (form.addressDetail.trim() === "") {
    blockReason = "Isi alamat detail pengiriman.";
  } else if (ratesStatus === "loading") {
    blockReason = "Menunggu pilihan pengiriman dimuat…";
  } else if (ratesStatus === "error") {
    blockReason = "Ongkir gagal dimuat. Tekan “Coba lagi” di atas.";
  } else if (!selectedRate) {
    blockReason = "Belum ada layanan pengiriman ke area ini.";
  }
  const canSubmit = blockReason === null && !isSubmitting;

  let shippingHint = "Pilih layanan pengiriman";
  if (!selectedArea) shippingHint = "Pilih area tujuan";
  else if (ratesStatus === "loading") shippingHint = "Memuat ongkir…";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // quoteSubtotal pasti ada kalau selectedRate ada (keduanya dari tarif
    // sukses yang sama) — dicek eksplisit supaya expected_total tidak pernah
    // dihitung dari harga cart.
    if (!canSubmit || !selectedArea || !selectedRate || quoteSubtotal === null) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      // Nominal ongkir/total BUKAN sumber tagihan — backend menghitung ulang
      // dan hanya memakai expected_* sebagai pembanding.
      const courierNote = form.courierNote.trim();
      const { order_number, snap_token, gross_amount } = await postOrder({
        idempotency_key: idempotencyKey,
        guest_name: form.name,
        guest_email: form.email,
        phone: form.phone,
        address_detail: form.addressDetail.trim(),
        courier_note: courierNote === "" ? null : courierNote,
        destination_area_id: selectedArea.id,
        area_label: selectedArea.label,
        postal_code: selectedArea.postal_code,
        courier_code: selectedRate.courier_code,
        service_code: selectedRate.service_code,
        expected_shipping_cost: selectedRate.cost,
        expected_total: quoteSubtotal + selectedRate.cost + serviceFee,
        items: items.map((item) => ({
          product_variant_id: item.productVariantId,
          quantity: item.qty,
        })),
      });

      router.push(
        `/checkout/payment?order=${encodeURIComponent(order_number)}&token=${encodeURIComponent(snap_token)}&gross=${gross_amount}`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan. Coba lagi sebentar.",
      );

      // Angka yang dilihat pembeli sudah basi → muat ulang tarif. Order tidak
      // dibuat (ditolak sebelum / di dalam transaksi yang di-rollback), jadi
      // submit berikutnya memakai idempotency key yang SAMA dengan aman.
      if (
        err instanceof OrderError &&
        err.code !== undefined &&
        QUOTE_ERROR_CODES.has(err.code)
      ) {
        // Layanan yang hilang tidak dipertahankan; kembali ke default termurah.
        if (err.code === "shipping_unavailable") setChosenRateId(null);
        setRatesRetry((n) => n + 1);
      }

      setIsSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
        <div className="mx-auto max-w-4xl">
          <h1 className="font-serif text-4xl font-light sm:text-6xl">
            Checkout
          </h1>
          <p className="mt-8 text-cream/70">
            Tidak ada item untuk di-checkout.
          </p>
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

  return (
    <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
      <div className="mx-auto max-w-6xl">
        <h1 className="sr-only">Checkout</h1>

        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-14">
          {/* Form penerima + metode pengiriman */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-10 lg:col-span-7"
          >
            <section className="flex flex-col gap-5">
              <SectionTitle>Alamat Pengiriman</SectionTitle>

              <Field
                id="name"
                label="Nama Penerima"
                placeholder="Masukkan nama lengkap Anda"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                placeholder="nama@domain.com"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
              />
              <Field
                id="phone"
                label="Nomor Telepon"
                type="tel"
                placeholder="+62 8..."
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
              />
              <AreaCombobox
                selected={selectedArea}
                onChange={(area) => {
                  setSelectedArea(area);
                  // Pembeli mengubah pilihan → pesan penolakan lama tidak
                  // relevan lagi.
                  setErrorMessage(null);
                }}
              />
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="address-detail"
                  className="text-xs font-medium uppercase tracking-wider text-cream/80"
                >
                  Alamat Detail
                </label>
                <textarea
                  id="address-detail"
                  required
                  rows={3}
                  maxLength={ADDRESS_DETAIL_MAX}
                  value={form.addressDetail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, addressDetail: e.target.value }))
                  }
                  className="w-full resize-y rounded-sm border border-cream/20 bg-ink-soft px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
                  placeholder="Nama jalan, nomor rumah, RT/RW, patokan"
                />
              </div>
              <Field
                id="courier-note"
                label="Catatan untuk Kurir (opsional)"
                placeholder="Mis. titip ke satpam, pagar hitam"
                value={form.courierNote}
                required={false}
                maxLength={COURIER_NOTE_MAX}
                onChange={(v) => setForm((f) => ({ ...f, courierNote: v }))}
              />
            </section>

            <section className="flex flex-col gap-5">
              <div className="flex items-baseline justify-between border-b border-cream/10 pb-2">
                <h2 className="font-serif text-sm font-medium uppercase tracking-[0.28em] text-gold">
                  Pilih Metode Pengiriman
                </h2>
                {ratesStatus === "success" && (
                  <span className="text-[11px] text-cream/50">
                    {rates.length} Layanan Tersedia
                  </span>
                )}
              </div>

              {/* ETD Biteship dihitung dari serah-terima ke kurir, bukan dari
                  waktu order — dijelaskan supaya pembeli tidak salah berharap. */}
              {ratesStatus === "success" && rates.length > 0 && (
                <p className="-mt-2 text-[11px] text-cream/50">
                  Estimasi dihitung sejak paket diserahkan ke kurir.
                </p>
              )}

              {ratesStatus === "idle" && (
                <p className="text-sm text-cream/60">
                  Pilih area tujuan untuk melihat pilihan pengiriman.
                </p>
              )}

              {ratesStatus === "loading" && (
                <div
                  role="status"
                  aria-label="Memuat pilihan pengiriman"
                  className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
                >
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className="flex animate-pulse flex-col justify-between rounded-sm border border-cream/15 bg-ink-soft p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-sm bg-cream/10" />
                        <div className="flex flex-col gap-1.5">
                          <span className="h-3 w-32 rounded-sm bg-cream/10" />
                          <span className="h-2.5 w-20 rounded-sm bg-cream/10" />
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-3">
                        <span className="h-2.5 w-16 rounded-sm bg-cream/10" />
                        <span className="h-3 w-14 rounded-sm bg-cream/10" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {ratesStatus === "error" && (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-3 rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-cream/90 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{ratesError}</span>
                  <button
                    type="button"
                    onClick={() => setRatesRetry((n) => n + 1)}
                    className="shrink-0 rounded-full border border-gold px-5 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-ink"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {ratesStatus === "success" && rates.length === 0 && (
                <p className="text-sm text-cream/60">
                  Belum ada layanan pengiriman ke area ini.
                </p>
              )}

              {ratesStatus === "success" && rates.length > 0 && (
                <div
                  role="radiogroup"
                  aria-label="Pilihan kurir pengiriman"
                  className="grid grid-cols-1 gap-3.5 sm:grid-cols-2"
                >
                  {rates.map((opt) => {
                    const id = rateId(opt);
                    const selected = id === selectedRateId;
                    const isCheapest = id === cheapestId;
                    const isFastest = id === fastestId;
                    return (
                      <label
                        key={id}
                        className={[
                          "group relative flex cursor-pointer flex-col justify-between rounded-sm border p-4 transition-colors focus-within:ring-1 focus-within:ring-gold",
                          selected
                            ? "border-gold bg-gold/10"
                            : "border-cream/15 bg-ink-soft hover:border-gold/60",
                        ].join(" ")}
                      >
                        {(isCheapest || isFastest) && (
                          <span className="absolute -top-2.5 right-3 flex gap-1.5">
                            {isCheapest && (
                              <span className="bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink">
                                Termurah
                              </span>
                            )}
                            {isFastest && (
                              <span className="border border-gold bg-ink px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold">
                                Tercepat
                              </span>
                            )}
                          </span>
                        )}
                        <input
                          type="radio"
                          name="courier"
                          value={id}
                          checked={selected}
                          onChange={() => {
                            setChosenRateId(id);
                            setErrorMessage(null);
                          }}
                          className="sr-only"
                        />

                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border font-serif text-xs font-bold text-gold",
                                selected
                                  ? "border-gold/50 bg-gold/15"
                                  : "border-cream/15 bg-ink",
                              ].join(" ")}
                            >
                              {courierBadge(opt.courier_code)}
                            </span>
                            <div>
                              <p className="text-sm font-medium leading-tight text-cream transition-colors group-hover:text-gold">
                                {opt.courier_name} {opt.service_name}
                              </p>
                              {opt.description && (
                                <p
                                  className={[
                                    "mt-0.5 text-[11px]",
                                    selected ? "text-gold/80" : "text-cream/50",
                                  ].join(" ")}
                                >
                                  {opt.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            aria-hidden="true"
                            className={[
                              "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-gold" : "border-cream/30",
                            ].join(" ")}
                          >
                            {selected && (
                              <span className="h-2 w-2 rounded-full bg-gold" />
                            )}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-3 text-[11px]">
                          <span className="flex items-center gap-1.5 text-cream/50">
                            <Icon
                              d={isFastest ? ICON.bolt : ICON.clock}
                              className={selected ? "text-gold" : "text-gold/70"}
                            />
                            {formatEtd(opt.etd)}
                          </span>
                          <span
                            className={[
                              "text-xs font-semibold",
                              selected ? "text-gold" : "text-cream",
                            ].join(" ")}
                          >
                            {formatRupiah(String(opt.cost))}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </section>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-cream/90"
              >
                {errorMessage}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={!canSubmit}
                aria-describedby={blockReason ? "submit-hint" : undefined}
                className={[
                  "w-full rounded-full px-8 py-4 text-sm font-medium uppercase tracking-[0.2em] transition-colors",
                  !canSubmit
                    ? "cursor-not-allowed border border-cream/20 text-cream/40"
                    : "bg-gold text-ink hover:bg-gold-dark",
                ].join(" ")}
              >
                {isSubmitting ? "Memproses…" : "Lanjut ke Pembayaran"}
              </button>
              {blockReason && !isSubmitting && (
                <p
                  id="submit-hint"
                  className="mt-3 text-center text-[11px] text-cream/50"
                >
                  {blockReason}
                </p>
              )}
              <p className="mt-4 flex items-center justify-center gap-3 text-[11px] text-cream/50">
                <span className="flex items-center gap-1.5">
                  <Icon d={ICON.shield} className="text-gold" />
                  Enkripsi 256-bit Aman
                </span>
                <span aria-hidden="true">•</span>
                <span>Garansi Keaslian 100%</span>
              </p>
            </div>
          </form>

          {/* Ringkasan pesanan */}
          <aside className="lg:sticky lg:top-24 lg:col-span-5 lg:h-fit">
            <div className="rounded-sm border border-cream/10 bg-ink-soft p-6 lg:p-7">
              <h2 className="border-b border-cream/10 pb-3 font-serif text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                Ringkasan Pesanan
              </h2>

              <ul className="mt-6 flex flex-col gap-4">
                {items.map((item) => (
                  <li
                    key={item.sku}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        aria-hidden="true"
                        className="flex h-14 w-12 shrink-0 items-center justify-center border border-cream/15 bg-ink font-serif text-[11px] text-gold/60"
                      >
                        {initials(item.name)}
                      </span>
                      <div>
                        <p className="text-sm font-medium leading-snug text-cream">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-cream/50">
                          ({item.size}) × {item.qty}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {formatRupiah(
                        String(
                          quoteLineTotals?.get(item.productVariantId) ??
                            Number.parseFloat(item.basePrice) * item.qty,
                        ),
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="mt-6 flex flex-col gap-3 border-t border-cream/10 pt-5 text-xs">
                <div className="flex justify-between text-cream/60">
                  <dt>Subtotal ({count} item)</dt>
                  <dd className="font-medium text-cream">
                    {formatRupiah(String(displaySubtotal))}
                  </dd>
                </div>
                <div className="flex justify-between text-cream/60">
                  <dt>
                    Biaya Pengiriman
                    <span className="block text-[10px] text-gold/80">
                      {selectedRate
                        ? `${selectedRate.courier_name} ${selectedRate.service_name}`
                        : shippingHint}
                    </span>
                  </dt>
                  <dd className="font-medium text-cream">
                    {selectedRate
                      ? formatRupiah(String(selectedRate.cost))
                      : "—"}
                  </dd>
                </div>
                {serviceFee > 0 && (
                  <div className="flex justify-between text-cream/60">
                    <dt>Biaya layanan</dt>
                    <dd className="font-medium text-cream">
                      {formatRupiah(String(serviceFee))}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between text-cream/60">
                  <dt>Asuransi Koleksi Mewah</dt>
                  <dd className="font-medium text-emerald-400">Gratis</dd>
                </div>
              </dl>

              <div className="mt-5 flex items-baseline justify-between border-t border-cream/10 pt-5">
                <span className="text-xs font-medium uppercase tracking-[0.22em] text-cream/60">
                  Total Tagihan
                </span>
                <span className="font-serif text-2xl font-semibold tracking-wide text-gold">
                  {formatRupiah(String(total))}
                </span>
              </div>

              <p className="mt-6 flex items-start gap-2 border border-cream/10 bg-ink p-3.5 text-[11px] leading-relaxed text-cream/60">
                <span aria-hidden="true" className="text-xs text-gold">
                  ♦
                </span>
                Setiap busana dikemas eksklusif dengan kotak premium, dust bag
                tahan debu, dan sertifikat nomor seri autentik.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

type AreaResult =
  | { query: string; areas: ShippingArea[]; error: null }
  | { query: string; areas: null; error: string };

/**
 * Autocomplete area tujuan (pola ARIA combobox + listbox).
 *
 * Mencari setelah ≥ AREA_MIN_CHARS karakter dengan debounce, dan membatalkan
 * request lama setiap kali pembeli mengetik lagi. Mengetik ulang setelah
 * memilih langsung menghapus pilihan (→ tarif di halaman ikut ter-reset),
 * supaya teks di input tidak pernah "terlihat terpilih" padahal ID-nya basi.
 */
function AreaCombobox({
  selected,
  onChange,
}: {
  selected: ShippingArea | null;
  onChange: (area: ShippingArea | null) => void;
}) {
  const [query, setQuery] = useState(selected?.label ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [result, setResult] = useState<AreaResult | null>(null);
  const listboxId = useId();
  const hintId = useId();

  const term = query.trim();
  const shouldSearch = selected === null && term.length >= AREA_MIN_CHARS;

  useEffect(() => {
    if (!shouldSearch) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchShippingAreas(term, controller.signal)
        .then((areas) => setResult({ query: term, areas, error: null }))
        .catch((err) => {
          if (isAbortError(err)) return;
          setResult({
            query: term,
            areas: null,
            error: err instanceof Error ? err.message : "Gagal mencari area.",
          });
        });
    }, AREA_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [shouldSearch, term]);

  // Status diturunkan dari hasil terakhir + term sekarang (bukan state
  // terpisah): hasil untuk term lain = masih memuat / menunggu debounce.
  let status: "idle" | "loading" | "error" | "empty" | "success" = "idle";
  let areas: ShippingArea[] = [];
  let error: string | null = null;

  if (shouldSearch) {
    if (!result || result.query !== term) {
      status = "loading";
    } else if (result.error !== null) {
      status = "error";
      error = result.error;
    } else if (result.areas.length === 0) {
      status = "empty";
    } else {
      status = "success";
      areas = result.areas;
    }
  }

  const showPanel = isOpen && status !== "idle";
  const showListbox = showPanel && areas.length > 0;
  const activeOption = showListbox ? areas[activeIndex] : undefined;
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  function choose(area: ShippingArea) {
    onChange(area);
    setQuery(area.label);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        if (areas.length === 0) return;
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex((i) => (i + 1) % areas.length);
        break;
      case "ArrowUp":
        if (areas.length === 0) return;
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex((i) => (i <= 0 ? areas.length - 1 : i - 1));
        break;
      case "Enter":
        // Enter memilih opsi aktif dan TIDAK men-submit form.
        if (activeOption) {
          e.preventDefault();
          choose(activeOption);
        }
        break;
      case "Escape":
        if (showPanel) {
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
        }
        break;
    }
  }

  let hint: string | null = null;
  if (selected?.postal_code) {
    hint = `Kode pos ${selected.postal_code}`;
  } else if (!selected && term.length > 0 && term.length < AREA_MIN_CHARS) {
    hint = `Ketik minimal ${AREA_MIN_CHARS} huruf untuk mencari.`;
  } else if (!selected && shouldSearch && !showPanel) {
    hint = "Pilih salah satu area dari daftar.";
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="area"
        className="text-xs font-medium uppercase tracking-wider text-cream/80"
      >
        Area Tujuan
      </label>
      <div className="relative">
        <input
          id="area"
          type="text"
          role="combobox"
          required
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-activedescendant={
            activeOption ? optionId(activeIndex) : undefined
          }
          aria-describedby={hint ? hintId : undefined}
          value={query}
          placeholder="Ketik kecamatan, kota, atau kode pos"
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
            setIsOpen(true);
            if (selected) onChange(null);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-sm border border-cream/20 bg-ink-soft px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
        />

        {showPanel && !showListbox && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-cream/20 bg-ink-soft shadow-lg">
            {status === "loading" && (
              <p role="status" className="px-4 py-3 text-sm text-cream/50">
                Mencari area…
              </p>
            )}
            {status === "empty" && (
              <p role="status" className="px-4 py-3 text-sm text-cream/50">
                Area tidak ditemukan. Coba kata kunci lain.
              </p>
            )}
            {status === "error" && (
              <p role="alert" className="px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Listbox selalu ada di DOM (target aria-controls), isinya hanya saat ada hasil. */}
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Hasil pencarian area"
          className={[
            "absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-cream/20 bg-ink-soft py-1 shadow-lg",
            showListbox ? "" : "hidden",
          ].join(" ")}
        >
          {showListbox &&
            areas.map((area, i) => {
              const active = i === activeIndex;
              return (
                <li
                  key={area.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={active}
                  // mousedown, bukan click: cegah input kehilangan fokus (blur
                  // menutup dropdown) sebelum pilihan sempat diproses.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(area);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={[
                    "cursor-pointer px-4 py-2.5 text-sm leading-snug",
                    active ? "bg-gold/15 text-gold" : "text-cream/90",
                  ].join(" ")}
                >
                  {area.label}
                </li>
              );
            })}
        </ul>
      </div>
      {hint && (
        <p id={hintId} className="text-[11px] text-cream/50">
          {hint}
        </p>
      )}
    </div>
  );
}

function rateId(rate: ShippingRate): string {
  return `${rate.courier_code}:${rate.service_code}`;
}

function courierBadge(code: string): string {
  return COURIER_BADGES[code.toLowerCase()] ?? code.slice(0, 3).toUpperCase();
}

/**
 * Estimasi Biteship ("1 - 2 days", "1 days") → rentang hari. `null` kalau
 * formatnya tidak dikenali (mis. satuan jam) — pemanggil menampilkan apa adanya.
 */
function parseEtdDays(etd: string | null): { min: number; max: number } | null {
  const match = etd
    ?.trim()
    .match(/^(\d+)(?:\s*-\s*(\d+))?\s*(?:days?|hari)$/i);
  if (!match) return null;

  const a = Number(match[1]);
  const b = match[2] !== undefined ? Number(match[2]) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** "1 - 2 days" → "1–2 hari"; "1 - 1 days" / "1 days" → "1 hari". */
function formatEtd(etd: string | null): string {
  const days = parseEtdDays(etd);
  if (!days) return etd ?? "Estimasi tidak tersedia";
  return days.min === days.max
    ? `${days.min} hari`
    : `${days.min}–${days.max} hari`;
}

/**
 * Label otomatis di kartu kurir:
 * - Termurah: cost terendah; seri → yang pertama (backend sudah urut termurah).
 * - Tercepat: batas atas estimasi hari terkecil; seri → yang termurah.
 *   Estimasi yang tidak bisa di-parse diabaikan.
 * Satu kartu boleh mendapat keduanya.
 */
function pickHighlights(rates: ShippingRate[]): {
  cheapestId: string | null;
  fastestId: string | null;
} {
  let cheapest: ShippingRate | null = null;
  let fastest: ShippingRate | null = null;
  let fastestMax = Number.POSITIVE_INFINITY;

  for (const rate of rates) {
    if (!cheapest || rate.cost < cheapest.cost) cheapest = rate;

    const days = parseEtdDays(rate.etd);
    if (!days) continue;
    if (
      days.max < fastestMax ||
      (days.max === fastestMax && fastest && rate.cost < fastest.cost)
    ) {
      fastest = rate;
      fastestMax = days.max;
    }
  }

  return {
    cheapestId: cheapest ? rateId(cheapest) : null,
    fastestId: fastest ? rateId(fastest) : null,
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-cream/10 pb-2 font-serif text-sm font-medium uppercase tracking-[0.28em] text-gold">
      {children}
    </h2>
  );
}

function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${className}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = true,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wider text-cream/80"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-cream/20 bg-ink-soft px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
      />
    </div>
  );
}
