"use client";

/**
 * Langkah 1 checkout: kumpulkan data penerima, lalu serahkan isi cart ke
 * backend.
 *
 * Submit → POST /api/orders (lib/api.ts `postOrder`): backend membuat order dari
 * item cart, mengambil harga/nama dari DB, dan meminta Snap token Midtrans.
 * Kalau sukses, lanjut ke /checkout/payment dengan `order` + `token` di query;
 * kalau gagal, pesan error dari backend ditampilkan di sini dan halaman tidak
 * berpindah (cart tetap utuh untuk dicoba lagi).
 *
 * Ongkir belum dihitung (Biteship belum terintegrasi) — backend memakai
 * shipping_cost = 0 untuk sekarang.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupiah, postOrder } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, count } = useCart();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Satu idempotency key per page load (lazy initializer → tidak di-generate
  // ulang tiap render). Retry submit setelah gagal mengirim key yang SAMA
  // supaya backend men-dedup. Reload halaman = key baru = percobaan baru.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { order_number, snap_token, gross_amount } = await postOrder({
        idempotency_key: idempotencyKey,
        guest_name: form.name,
        guest_email: form.email,
        phone: form.phone,
        address: form.address,
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
      <div className="mx-auto max-w-4xl">
        <h1 className="font-serif text-4xl font-light sm:text-6xl">Checkout</h1>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem]">
          {/* Form penerima */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">
              Alamat Pengiriman
            </p>

            <Field
              id="name"
              label="Nama Penerima"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <Field
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            />
            <Field
              id="phone"
              label="Nomor Telepon"
              type="tel"
              value={form.phone}
              onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            />
            <div className="flex flex-col gap-2">
              <label
                htmlFor="address"
                className="text-sm text-cream/70"
              >
                Alamat Lengkap
              </label>
              <textarea
                id="address"
                required
                rows={4}
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                className="w-full rounded-sm border border-cream/20 bg-transparent px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
                placeholder="Jalan, nomor rumah, kota, kode pos"
              />
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-sm border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm leading-relaxed text-cream/90"
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                "mt-2 w-full rounded-full px-8 py-3.5 text-sm font-medium uppercase tracking-[0.2em] transition-colors sm:w-auto",
                isSubmitting
                  ? "cursor-not-allowed border border-cream/20 text-cream/40"
                  : "bg-gold text-ink hover:bg-gold-dark",
              ].join(" ")}
            >
              {isSubmitting ? "Memproses…" : "Lanjut ke Pembayaran"}
            </button>
          </form>

          {/* Ringkasan pesanan */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-sm border border-cream/10 bg-ink-soft p-6">
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">
                Ringkasan Pesanan
              </p>
              <ul className="mt-5 flex flex-col gap-3">
                {items.map((item) => (
                  <li
                    key={item.sku}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <span className="text-cream/70">
                      {item.name}{" "}
                      <span className="text-cream/40">
                        ({item.size}) × {item.qty}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {formatRupiah(
                        String(Number.parseFloat(item.basePrice) * item.qty),
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex justify-between border-t border-cream/10 pt-5 text-sm">
                <span className="text-cream/70">Subtotal ({count} item)</span>
                <span className="font-medium">
                  {formatRupiah(String(subtotal))}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm text-cream/70">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-cream/20 bg-transparent px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
      />
    </div>
  );
}
