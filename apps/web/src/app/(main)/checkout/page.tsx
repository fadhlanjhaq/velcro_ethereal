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
 * (`meta.service_fee`, barisnya tidak tampil kalau 0) + asuransi pengiriman
 * kalau dicentang — sama dengan gross_amount, jadi harga lama di cart tidak
 * bisa membuat order ditolak terus.
 *
 * Asuransi pengiriman: OPSIONAL, tidak tercentang secara default, dibayar
 * pembeli. Biayanya dari Biteship per layanan (`insurance_fee`, tanpa markup);
 * nonaktif kalau layanan terpilih tidak mendukung.
 *
 * Submit mengirim area, layanan terpilih, serta ongkir & total yang DILIHAT
 * pembeli (`expected_*`). Backend menghitung ulang lewat jalur tarif yang
 * sama; kalau hasilnya berbeda, order ditolak 422 dengan `code`
 * (shipping_unavailable / shipping_cost_changed / insurance_unavailable /
 * insurance_changed / total_changed) dan TIDAK
 * dibuat. Halaman ini lalu menampilkan pesannya dan memuat ulang tarif —
 * yang sekaligus menyegarkan harga produk, ongkir, dan ringkasan — dan pembeli
 * cukup submit sekali lagi dengan idempotency key yang sama. Lihat
 * docs/decisions/shipping-biteship.md.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type Lenis from "lenis";
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
import { useLenis } from "@/components/SmoothScrollProvider";

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
  "insurance_unavailable",
  "insurance_changed",
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

// Field yang divalidasi di sisi client sebelum submit. Urutan array = urutan
// tampil di form = urutan pemilihan field pertama yang difokuskan.
type FieldKey = "name" | "email" | "phone" | "area" | "addressDetail";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = [
  "name",
  "email",
  "phone",
  "area",
  "addressDetail",
];

// id elemen input per field (target scroll + fokus).
const FIELD_ELEMENT_ID: Record<FieldKey, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  area: "area",
  addressDetail: "address-detail",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ringkasan pesanan sticky HANYA di lg DAN tinggi viewport ≥ 600px. Di bawah
// itu tampil normal: tidak sticky, tanpa max-height, tanpa scroll internal.
// Offset memakai --site-header-h yang ditulis SiteHeader (fallback 96px).
const SUMMARY_STICKY_ASIDE =
  "lg:[@media(min-height:600px)]:sticky lg:[@media(min-height:600px)]:top-[calc(var(--site-header-h,96px)_+_24px)]";
const SUMMARY_STICKY_CARD =
  "lg:[@media(min-height:600px)]:max-h-[calc(100dvh_-_var(--site-header-h,96px)_-_48px)]";
const SUMMARY_SCROLL_AREA =
  "lg:[@media(min-height:600px)]:min-h-0 lg:[@media(min-height:600px)]:flex-1 lg:[@media(min-height:600px)]:overflow-y-auto lg:[@media(min-height:600px)]:pr-2";

/**
 * Scroll elemen ke kira-kira tengah layar (tidak pernah tertutup header
 * fixed), lalu fokus tanpa memicu scroll native kedua. Lenis dipakai kalau
 * aktif; kalau tidak (reduced-motion / di luar provider) → scrollIntoView.
 */
function scrollToElement(
  el: HTMLElement,
  lenis: Lenis | null | undefined,
  { focus = true }: { focus?: boolean } = {},
) {
  const headerH =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--site-header-h",
      ),
    ) || 96;
  const offset = -Math.max(
    headerH + 32,
    (window.innerHeight - el.offsetHeight) / 2,
  );

  if (lenis) {
    lenis.scrollTo(el, { offset });
  } else {
    el.scrollIntoView({ block: "center" });
  }

  if (focus) el.focus({ preventScroll: true });
}

const SHEET_ID = "checkout-summary-sheet";
const SHEET_TITLE_ID = "checkout-summary-sheet-title";
const DESKTOP_MEDIA = "(min-width: 1024px)";

// Kunci / buka scroll halaman (Lenis + native) untuk bottom sheet. Dipanggil
// dari effect sheet, dan langsung dari handleSubmit saat sheet harus ditutup
// sebelum scroll ke field (Lenis yang masih stop() tidak mau men-scroll).
function lockPageScroll(lenis: Lenis | null | undefined) {
  lenis?.stop();
  document.documentElement.style.overflow = "hidden";
}

function unlockPageScroll(lenis: Lenis | null | undefined) {
  lenis?.start();
  document.documentElement.style.overflow = "";
}

// true hanya di client setelah hydrate — syarat aman untuk createPortal ke
// document.body tanpa hydration mismatch.
const noopSubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

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
  // Keinginan pembeli soal asuransi. Yang benar-benar dipakai = keinginan ini
  // DAN layanan terpilih mendukung asuransi (lihat `withInsurance`).
  const [wantsInsurance, setWantsInsurance] = useState(false);
  const [ratesResult, setRatesResult] = useState<RatesResult | null>(null);
  // Dinaikkan oleh tombol "Coba lagi" dan oleh error quote dari POST
  // /api/orders → key berubah → tarif diambil ulang (state lama dilewati).
  const [ratesRetry, setRatesRetry] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const lenisRef = useLenis();

  // --- Mobile: bar bawah + bottom sheet ringkasan ---------------------------
  const isClient = useIsClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Elemen bar disimpan lewat callback ref (state), bukan useRef: bar baru
  // ter-render setelah cart terisi, jadi effect harus jalan ulang saat itu.
  const [mobileBar, setMobileBar] = useState<HTMLDivElement | null>(null);
  const openSheetButtonRef = useRef<HTMLButtonElement>(null);
  const sheetCloseButtonRef = useRef<HTMLButtonElement>(null);
  const sheetWasOpenRef = useRef(false);
  // Diset saat sheet ditutup karena validasi gagal: fokus pindah ke field
  // yang salah, bukan kembali ke tombol "Lihat ringkasan".
  const skipSheetFocusReturnRef = useRef(false);

  // Konten paling bawah halaman tidak boleh tertutup bar fixed. Di lg bar
  // display:none → tinggi 0 → padding 0.
  useEffect(() => {
    if (!mobileBar) return;
    const body = document.body;
    const write = () => {
      body.style.paddingBottom = `${mobileBar.offsetHeight}px`;
    };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(mobileBar);
    return () => {
      observer.disconnect();
      body.style.paddingBottom = "";
    };
  }, [mobileBar]);

  // Sheet terbuka: kunci scroll, Escape menutup, dan tutup otomatis kalau
  // viewport melebar ke lg (ringkasan desktop mengambil alih).
  useEffect(() => {
    if (!sheetOpen) return;
    const lenis = lenisRef?.current;
    lockPageScroll(lenis);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSheetOpen(false);
    }
    const desktop = window.matchMedia(DESKTOP_MEDIA);
    function onMediaChange(event: MediaQueryListEvent) {
      if (event.matches) setSheetOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onMediaChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onMediaChange);
      unlockPageScroll(lenis);
    };
  }, [sheetOpen, lenisRef]);

  // Fokus: buka → tombol X; tutup → kembali ke tombol "Lihat ringkasan".
  useEffect(() => {
    if (sheetOpen) {
      sheetWasOpenRef.current = true;
      sheetCloseButtonRef.current?.focus();
      return;
    }
    if (!sheetWasOpenRef.current) return;
    sheetWasOpenRef.current = false;
    if (skipSheetFocusReturnRef.current) {
      skipSheetFocusReturnRef.current = false;
      return;
    }
    openSheetButtonRef.current?.focus();
  }, [sheetOpen]);

  /**
   * Scroll + fokus ke elemen bermasalah. Kalau submit datang dari sheet,
   * sheet ditutup DULU dan scroll page dibuka langsung (bukan menunggu
   * effect), lalu scroll dijalankan di frame berikutnya.
   */
  function revealInvalid(el: HTMLElement, options?: { focus?: boolean }) {
    if (!sheetOpen) {
      scrollToElement(el, lenisRef?.current, options);
      return;
    }
    skipSheetFocusReturnRef.current = true;
    unlockPageScroll(lenisRef?.current);
    setSheetOpen(false);
    requestAnimationFrame(() => {
      scrollToElement(el, lenisRef?.current, options);
    });
  }

  // Error satu field dihapus begitu field itu diubah.
  function clearFieldError(key: FieldKey) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

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
  // Asuransi hanya bisa dipilih kalau layanan terpilih mendukungnya. Kalau
  // tidak (mis. setelah tarif dimuat ulang / default termurah berganti), kotak
  // centang otomatis tampil tidak tercentang dan biayanya tidak dihitung.
  const insuranceSelectable =
    selectedRate !== null &&
    selectedRate.insurance_available &&
    selectedRate.insurance_fee > 0;
  const withInsurance = wantsInsurance && insuranceSelectable;
  const insuranceFee = withInsurance ? (selectedRate?.insurance_fee ?? 0) : 0;
  const displaySubtotal = quoteSubtotal ?? Number(subtotal);
  // Rumus sama dengan gross_amount backend: subtotal backend + ongkir + biaya
  // layanan + asuransi (semuanya rupiah bulat). Ini yang dikirim sebagai
  // expected_total.
  const total = displaySubtotal + shippingCost + serviceFee + insuranceFee;

  // Tombol submit hanya dinonaktifkan selama proses berjalan / ongkir dimuat.
  // Kekurangan lain (field kosong, pengiriman bermasalah) ditangani validasi
  // di handleSubmit, yang menandai field dan membawa pembeli ke sana.
  const submitDisabled = isSubmitting || ratesStatus === "loading";
  const submitLabel = isSubmitting
    ? "Memproses…"
    : ratesStatus === "loading"
      ? "Memuat ongkir…"
      : "Lanjut ke Pembayaran";

  let shippingHint = "Pilih layanan pengiriman";
  if (!selectedArea) shippingHint = "Pilih area tujuan";
  else if (ratesStatus === "loading") shippingHint = "Memuat ongkir…";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Enter di input tetap bisa memicu submit walau tombol disabled.
    if (submitDisabled) return;

    // Validasi client: tandai SEMUA field yang salah, fokuskan yang pertama.
    const errors: FieldErrors = {};
    if (form.name.trim() === "") {
      errors.name = "Nama penerima wajib diisi.";
    }
    const email = form.email.trim();
    if (email === "") {
      errors.email = "Email wajib diisi.";
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Format email tidak valid.";
    }
    // Format nomor telepon tetap divalidasi backend.
    if (form.phone.trim() === "") {
      errors.phone = "Nomor telepon wajib diisi.";
    }
    if (!selectedArea) {
      errors.area = "Pilih area tujuan dari daftar.";
    }
    if (form.addressDetail.trim() === "") {
      errors.addressDetail = "Alamat detail wajib diisi.";
    }
    setFieldErrors(errors);

    const firstInvalid = FIELD_ORDER.find((key) => errors[key]);
    if (firstInvalid) {
      const el = document.getElementById(FIELD_ELEMENT_ID[firstInvalid]);
      if (el) revealInvalid(el);
      return;
    }

    // Field lengkap tapi pengiriman bermasalah → bawa ke section pengiriman
    // (pesannya sudah tampil di sana).
    if (
      ratesStatus === "error" ||
      (ratesStatus === "success" && rates.length === 0) ||
      !selectedRate
    ) {
      const section = document.getElementById("shipping-method");
      if (section) revealInvalid(section, { focus: false });
      return;
    }

    // quoteSubtotal pasti ada kalau selectedRate ada (keduanya dari tarif
    // sukses yang sama) — dicek eksplisit supaya expected_total tidak pernah
    // dihitung dari harga cart.
    if (!selectedArea || !selectedRate || quoteSubtotal === null) {
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
        guest_name: form.name.trim(),
        guest_email: form.email.trim(),
        phone: form.phone.trim(),
        address_detail: form.addressDetail.trim(),
        courier_note: courierNote === "" ? null : courierNote,
        destination_area_id: selectedArea.id,
        area_label: selectedArea.label,
        postal_code: selectedArea.postal_code,
        courier_code: selectedRate.courier_code,
        service_code: selectedRate.service_code,
        expected_shipping_cost: selectedRate.cost,
        expected_total:
          quoteSubtotal + selectedRate.cost + serviceFee + insuranceFee,
        with_insurance: withInsurance,
        expected_insurance_fee: insuranceFee,
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
        // Asuransi tidak tersedia lagi → lepas centangnya; pembeli bisa
        // lanjut tanpa asuransi atau memilih layanan lain lalu mencentang ulang.
        if (err.code === "insurance_unavailable") setWantsInsurance(false);
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

  // Props bersama untuk ringkasan desktop & sheet, dan untuk kedua checkbox
  // asuransi (footer desktop & bawah pilihan kurir di mobile).
  const summaryProps: SummaryProps = {
    items,
    count,
    quoteLineTotals,
    displaySubtotal,
    selectedRate,
    shippingHint,
    serviceFee,
    withInsurance,
    insuranceFee,
    total,
  };
  const insuranceProps = {
    checked: withInsurance,
    selectable: insuranceSelectable,
    selectedRate,
    coverage: quoteSubtotal ?? displaySubtotal,
    onChange: (checked: boolean) => {
      setWantsInsurance(checked);
      setErrorMessage(null);
    },
  };

  return (
    <main className="flex-1 bg-ink px-6 pb-24 pt-28 text-cream sm:pt-36">
      <div className="mx-auto max-w-6xl">
        <h1 className="sr-only">Checkout</h1>

        <div className="grid gap-10 lg:grid-cols-12 lg:items-start lg:gap-14">
          {/* Form penerima + metode pengiriman */}
          {/* noValidate: validasi native browser dimatikan, diganti validasi
              custom di handleSubmit. Tombol submit ada di ringkasan (di luar
              <form>) dan terhubung lewat atribut form="checkout-form". */}
          <form
            id="checkout-form"
            noValidate
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
                error={fieldErrors.name}
                onChange={(v) => {
                  setForm((f) => ({ ...f, name: v }));
                  clearFieldError("name");
                }}
              />
              <Field
                id="email"
                label="Email"
                type="email"
                placeholder="nama@domain.com"
                value={form.email}
                error={fieldErrors.email}
                onChange={(v) => {
                  setForm((f) => ({ ...f, email: v }));
                  clearFieldError("email");
                }}
              />
              <Field
                id="phone"
                label="Nomor Telepon"
                type="tel"
                placeholder="+62 8..."
                value={form.phone}
                error={fieldErrors.phone}
                onChange={(v) => {
                  setForm((f) => ({ ...f, phone: v }));
                  clearFieldError("phone");
                }}
              />
              <AreaCombobox
                selected={selectedArea}
                error={fieldErrors.area}
                onChange={(area) => {
                  setSelectedArea(area);
                  if (area) clearFieldError("area");
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
                  aria-invalid={fieldErrors.addressDetail ? true : undefined}
                  aria-describedby={
                    fieldErrors.addressDetail
                      ? "address-detail-error"
                      : undefined
                  }
                  onChange={(e) => {
                    setForm((f) => ({ ...f, addressDetail: e.target.value }));
                    clearFieldError("addressDetail");
                  }}
                  className={[
                    "w-full resize-y rounded-sm border bg-ink-soft px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none",
                    fieldErrors.addressDetail
                      ? "border-red-400/60"
                      : "border-cream/20",
                  ].join(" ")}
                  placeholder="Nama jalan, nomor rumah, RT/RW, patokan"
                />
                {fieldErrors.addressDetail && (
                  <p
                    id="address-detail-error"
                    className="text-[11px] text-red-300"
                  >
                    {fieldErrors.addressDetail}
                  </p>
                )}
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

            <section id="shipping-method" className="flex flex-col gap-5">
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
                            // Layanan tanpa asuransi → centang dilepas, jadi
                            // tidak "muncul sendiri" saat kembali ke layanan
                            // yang mendukung.
                            const insurable =
                              opt.insurance_available && opt.insurance_fee > 0;
                            if (!insurable) setWantsInsurance(false);
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

              {/* Mobile: asuransi di bawah pilihan kurir (di desktop ada di
                  footer ringkasan). Hanya tampil kalau ada kartu kurir. */}
              {ratesStatus === "success" && rates.length > 0 && (
                <InsuranceOption
                  {...insuranceProps}
                  idPrefix="mobile"
                  className="rounded-sm border border-cream/15 bg-ink-soft p-4 lg:hidden"
                />
              )}
            </section>
          </form>

          {/* Ringkasan pesanan. Di lg + tinggi viewport ≥ 600px: sticky dan
              dibatasi tinggi layar — header & footer kartu tetap, hanya daftar
              item yang di-scroll. Di bawah itu tampil normal. */}
          <aside
            className={`hidden lg:col-span-5 lg:block lg:h-fit ${SUMMARY_STICKY_ASIDE}`}
          >
            <div
              className={`flex flex-col rounded-sm border border-cream/10 bg-ink-soft p-6 lg:p-7 ${SUMMARY_STICKY_CARD}`}
            >
              {/* 1) Header tetap */}
              <h2 className="shrink-0 border-b border-cream/10 pb-3 font-serif text-xs font-semibold uppercase tracking-[0.22em] text-gold">
                Ringkasan Pesanan
              </h2>

              {/* 2) Area scroll + 3) footer tetap — lihat OrderSummaryContent */}
              <OrderSummaryContent
                {...summaryProps}
                variant="desktop"
                idPrefix="desktop"
                insuranceSlot={
                  <InsuranceOption
                    {...insuranceProps}
                    idPrefix="desktop"
                    className="mt-4 border-t border-cream/10 pt-4"
                  />
                }
                footerSlot={
                  <>
                    {errorMessage && (
                      <p
                        role="alert"
                        className="mt-5 rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-cream/90"
                      >
                        {errorMessage}
                      </p>
                    )}

                    <SubmitButton
                      disabled={submitDisabled}
                      label={submitLabel}
                      className="mt-5"
                    />

                    <p className="mt-4 flex items-center justify-center gap-3 text-[11px] text-cream/50">
                      <span className="flex items-center gap-1.5">
                        <Icon d={ICON.shield} className="text-gold" />
                        Enkripsi 256-bit Aman
                      </span>
                      <span aria-hidden="true">•</span>
                      <span>Garansi Keaslian 100%</span>
                    </p>
                  </>
                }
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile (< lg): bar tetap di bawah — total, buka ringkasan, submit. */}
      <div
        ref={setMobileBar}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink/95 px-6 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md lg:hidden"
      >
        {errorMessage && (
          <p
            role="alert"
            className="mb-3 rounded-sm border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-cream/90"
          >
            {errorMessage}
          </p>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-cream/60">
              Total
            </p>
            <p className="font-serif text-xl font-semibold tracking-wide text-gold">
              {formatRupiah(String(total))}
            </p>
          </div>
          <button
            ref={openSheetButtonRef}
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-controls={SHEET_ID}
            aria-haspopup="dialog"
            className="shrink-0 text-xs font-medium text-cream/80 underline-offset-4 transition-colors hover:text-gold hover:underline"
          >
            Lihat ringkasan ({count} item){" "}
            <span aria-hidden="true">▲</span>
          </button>
        </div>
        <SubmitButton
          disabled={submitDisabled}
          label={submitLabel}
          className="mt-3"
        />
      </div>

      {/* Mobile: bottom sheet ringkasan (portal ke body, di atas header). */}
      {isClient &&
        createPortal(
          <div
            inert={!sheetOpen}
            aria-hidden={sheetOpen ? undefined : true}
            className={[
              "fixed inset-0 z-[60] lg:hidden",
              sheetOpen ? "" : "pointer-events-none",
            ].join(" ")}
          >
            <div
              aria-hidden="true"
              onClick={() => setSheetOpen(false)}
              className={[
                "fixed inset-0 bg-black/60 transition-opacity duration-300",
                sheetOpen ? "opacity-100" : "opacity-0",
              ].join(" ")}
            />
            <div
              id={SHEET_ID}
              role="dialog"
              aria-modal="true"
              aria-labelledby={SHEET_TITLE_ID}
              className={[
                "fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-sm border-t border-cream/10 bg-ink-soft text-cream transition-transform duration-300",
                sheetOpen ? "translate-y-0" : "translate-y-full",
              ].join(" ")}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-cream/10 px-6 py-4">
                <h2
                  id={SHEET_TITLE_ID}
                  className="font-serif text-xs font-semibold uppercase tracking-[0.22em] text-gold"
                >
                  Ringkasan Pesanan
                </h2>
                <button
                  ref={sheetCloseButtonRef}
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Tutup ringkasan"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream/20 text-cream transition-colors hover:border-gold hover:text-gold"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div
                data-lenis-prevent
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
              >
                <OrderSummaryContent
                  {...summaryProps}
                  variant="sheet"
                  idPrefix="sheet"
                />
              </div>

              <div className="shrink-0 border-t border-cream/10 px-6 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                {/* Error backend juga di sini: kalau submit dari sheet gagal,
                    bar di bawah tertutup backdrop dan pesannya tak terlihat. */}
                {errorMessage && (
                  <p
                    role="alert"
                    className="mb-3 rounded-sm border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs leading-relaxed text-cream/90"
                  >
                    {errorMessage}
                  </p>
                )}
                <SubmitButton disabled={submitDisabled} label={submitLabel} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </main>
  );
}

type SummaryProps = {
  items: ReturnType<typeof useCart>["items"];
  count: number;
  quoteLineTotals: Map<number, number> | null;
  displaySubtotal: number;
  selectedRate: ShippingRate | null;
  shippingHint: string;
  serviceFee: number;
  withInsurance: boolean;
  insuranceFee: number;
  total: number;
};

/**
 * Isi ringkasan pesanan: daftar item, catatan kemasan, rincian biaya, total.
 *
 * - "desktop": dua bagian — area scroll (item + catatan) dan footer tetap
 *   (rincian, `insuranceSlot`, total, `footerSlot`), sesuai kartu sticky.
 * - "sheet": satu alur biasa (sheet punya area scroll sendiri). Tanpa checkbox
 *   asuransi; baris asuransi di rincian tetap tampil kalau dicentang.
 *
 * `idPrefix` memberi namespace id di dalamnya supaya dua versi yang ter-render
 * bersamaan tidak menghasilkan id ganda.
 */
function OrderSummaryContent({
  variant,
  idPrefix,
  insuranceSlot,
  footerSlot,
  ...data
}: SummaryProps & {
  variant: "desktop" | "sheet";
  idPrefix: string;
  insuranceSlot?: ReactNode;
  footerSlot?: ReactNode;
}) {
  const itemList = (
    <>
      <ul className="flex flex-col gap-4">
        {data.items.map((item) => (
          <li
            key={item.sku}
            className="flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              {item.image ? (
                <span className="relative h-14 w-12 shrink-0 overflow-hidden border border-cream/15 bg-ink">
                  <Image
                    src={item.image}
                    alt={`${item.name} (${item.size})`}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-14 w-12 shrink-0 items-center justify-center border border-cream/15 bg-ink font-serif text-[11px] text-gold/60"
                >
                  {initials(item.name)}
                </span>
              )}
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
                  data.quoteLineTotals?.get(item.productVariantId) ??
                    Number.parseFloat(item.basePrice) * item.qty,
                ),
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 flex items-start gap-2 border border-cream/10 bg-ink p-3.5 text-[11px] leading-relaxed text-cream/60">
        <span aria-hidden="true" className="text-xs text-gold">
          ♦
        </span>
        Setiap busana dikemas eksklusif dengan kotak premium, dust bag tahan
        debu, dan sertifikat nomor seri autentik.
      </p>
    </>
  );

  const breakdown = (
    <dl className="mt-6 flex flex-col gap-3 border-t border-cream/10 pt-5 text-xs">
      <div className="flex justify-between text-cream/60">
        <dt>Subtotal ({data.count} item)</dt>
        <dd className="font-medium text-cream">
          {formatRupiah(String(data.displaySubtotal))}
        </dd>
      </div>
      <div className="flex justify-between text-cream/60">
        <dt>
          Biaya Pengiriman
          <span className="block text-[10px] text-gold/80">
            {data.selectedRate
              ? `${data.selectedRate.courier_name} ${data.selectedRate.service_name}`
              : data.shippingHint}
          </span>
        </dt>
        <dd className="font-medium text-cream">
          {data.selectedRate
            ? formatRupiah(String(data.selectedRate.cost))
            : "—"}
        </dd>
      </div>
      {data.serviceFee > 0 && (
        <div className="flex justify-between text-cream/60">
          <dt>Biaya layanan</dt>
          <dd className="font-medium text-cream">
            {formatRupiah(String(data.serviceFee))}
          </dd>
        </div>
      )}
      {data.withInsurance && (
        <div className="flex justify-between text-cream/60">
          <dt>Asuransi pengiriman</dt>
          <dd className="font-medium text-cream">
            {formatRupiah(String(data.insuranceFee))}
          </dd>
        </div>
      )}
    </dl>
  );

  const totalRow = (
    <div
      id={`${idPrefix}-summary-total`}
      className="mt-5 flex items-baseline justify-between border-t border-cream/10 pt-5"
    >
      <span className="text-xs font-medium uppercase tracking-[0.22em] text-cream/60">
        Total Tagihan
      </span>
      <span className="font-serif text-2xl font-semibold tracking-wide text-gold">
        {formatRupiah(String(data.total))}
      </span>
    </div>
  );

  if (variant === "sheet") {
    return (
      <>
        {itemList}
        {breakdown}
        {totalRow}
      </>
    );
  }

  return (
    <>
      {/* Area scroll: daftar item + catatan kemasan. data-lenis-prevent:
          wheel di sini men-scroll daftar, tidak dibajak Lenis. */}
      <div data-lenis-prevent className={`mt-6 ${SUMMARY_SCROLL_AREA}`}>
        {itemList}
      </div>

      {/* Footer tetap: rincian biaya, asuransi, total, submit */}
      <div className="shrink-0">
        {breakdown}
        {insuranceSlot}
        {totalRow}
        {footerSlot}
      </div>
    </>
  );
}

/**
 * Checkbox asuransi pengiriman — opsional, dibayar pembeli. Teks bantu
 * sengaja hanya menyebut nilai pertanggungan & kebijakan kurir: cakupan klaim
 * ditentukan kurir, bukan oleh toko. State/logika tetap di CheckoutPage.
 */
function InsuranceOption({
  idPrefix,
  checked,
  selectable,
  selectedRate,
  coverage,
  onChange,
  className = "",
}: {
  idPrefix: string;
  checked: boolean;
  selectable: boolean;
  selectedRate: ShippingRate | null;
  coverage: number;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  const hintId = `${idPrefix}-insurance-hint`;
  return (
    <div className={className}>
      <label
        className={[
          "flex items-start gap-3 text-xs",
          selectable ? "cursor-pointer" : "cursor-not-allowed opacity-60",
        ].join(" ")}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!selectable}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-gold"
        />
        <span className="flex-1">
          <span className="flex justify-between gap-3 text-cream/80">
            <span>Tambah asuransi pengiriman</span>
            {selectable && (
              <span className="font-medium text-cream">
                {formatRupiah(String(selectedRate?.insurance_fee ?? 0))}
              </span>
            )}
          </span>
          <span
            id={hintId}
            className="mt-1 block text-[11px] leading-relaxed text-cream/50"
          >
            {!selectedRate
              ? "Pilih layanan pengiriman untuk melihat biaya asuransi."
              : !selectable
                ? "Tidak tersedia untuk layanan ini"
                : `Nilai pertanggungan ${formatRupiah(String(coverage))}. Ketentuan klaim mengikuti kebijakan kurir.`}
          </span>
        </span>
      </label>
    </div>
  );
}

/**
 * Tombol submit form checkout. Dipakai di ringkasan desktop, bar mobile, dan
 * bottom sheet — semuanya di luar <form>, terhubung lewat form="checkout-form".
 */
function SubmitButton({
  disabled,
  label,
  className = "",
}: {
  disabled: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      form="checkout-form"
      disabled={disabled}
      className={[
        "w-full rounded-full px-8 py-4 text-sm font-medium uppercase tracking-[0.2em] transition-colors",
        disabled
          ? "cursor-not-allowed border border-cream/20 text-cream/40"
          : "bg-gold text-ink hover:bg-gold-dark",
        className,
      ].join(" ")}
    >
      {label}
    </button>
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
  error: fieldError,
}: {
  selected: ShippingArea | null;
  onChange: (area: ShippingArea | null) => void;
  error?: string;
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

  const fieldErrorId = "area-error";
  const describedBy =
    [hint ? hintId : null, fieldError ? fieldErrorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

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
          aria-describedby={describedBy}
          aria-invalid={fieldError ? true : undefined}
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
          className={[
            "w-full rounded-sm border bg-ink-soft px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none",
            fieldError ? "border-red-400/60" : "border-cream/20",
          ].join(" ")}
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
      {fieldError && (
        <p id={fieldErrorId} className="text-[11px] text-red-300">
          {fieldError}
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
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  error?: string;
}) {
  const errorId = `${id}-error`;
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-full rounded-sm border bg-ink-soft px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none",
          error ? "border-red-400/60" : "border-cream/20",
        ].join(" ")}
      />
      {error && (
        <p id={errorId} className="text-[11px] text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
