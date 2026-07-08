"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Footer global (Milestone 6, Bagian A) — dipasang di root layout, muncul di
 * semua halaman. Memakai design tokens Milestone 4 (tanpa warna baru).
 *
 * Form "Kabar Rilis Terbatas" adalah PLACEHOLDER: submit TIDAK terhubung ke
 * backend / email service / ESP apa pun — hanya menampilkan konfirmasi inline.
 * Menunggu integrasi email service sungguhan di milestone terpisah.
 */
const INSTAGRAM_URL = "https://www.instagram.com/velcroethereal";

export default function SiteFooter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // PLACEHOLDER — belum ada integrasi email service. Cukup konfirmasi inline.
    setSubmitted(true);
  }

  return (
    <footer className="border-t border-cream/10 bg-ink-soft px-6 py-16 text-cream sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {/* Kolom 1 — brand */}
        <div className="flex flex-col gap-5">
          <p className="font-serif text-lg font-medium uppercase tracking-[0.3em]">
            Velcro Ethereal
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-cream/60">
            Pakaian bordir tangan — warisan yang dijahit untuk melampaui musim.
          </p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 text-sm text-cream/70 transition-colors hover:text-gold"
            aria-label="Instagram Velcro Ethereal (buka di tab baru)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
            </svg>
            @velcroethereal
          </a>
        </div>

        {/* Kolom 2 — Koleksi */}
        <nav aria-label="Koleksi" className="flex flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">
            Koleksi
          </p>
          <Link
            href="/shop"
            className="w-fit text-sm text-cream/70 transition-colors hover:text-gold"
          >
            Heritage Collection
          </Link>
        </nav>

        {/* Kolom 3 — Tentang (anchor ke section landing) */}
        <nav aria-label="Tentang" className="flex flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">
            Tentang
          </p>
          <Link
            href="/#filosofi"
            className="w-fit text-sm text-cream/70 transition-colors hover:text-gold"
          >
            Filosofi Brand
          </Link>
          <Link
            href="/#craftsmanship"
            className="w-fit text-sm text-cream/70 transition-colors hover:text-gold"
          >
            Craftsmanship
          </Link>
        </nav>

        {/* Kolom 4 — Newsletter (placeholder, tanpa backend) */}
        <div className="flex flex-col gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold">
            Kabar Rilis Terbatas
          </p>
          {submitted ? (
            <p className="text-sm leading-relaxed text-cream/80" role="status">
              Terima kasih! Kami akan mengabari saat rilis berikutnya.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label htmlFor="footer-email" className="sr-only">
                Alamat email
              </label>
              <input
                id="footer-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@anda.com"
                className="w-full rounded-sm border border-cream/20 bg-transparent px-4 py-3 text-sm text-cream placeholder:text-cream/40 focus:border-gold focus:outline-none"
              />
              <button
                type="submit"
                className="w-fit rounded-full border border-gold px-6 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-cream transition-colors hover:bg-gold hover:text-ink"
              >
                Kirim
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mx-auto mt-14 max-w-6xl border-t border-cream/10 pt-8">
        <p className="text-xs uppercase tracking-[0.25em] text-cream/40">
          © 2026 Velcro Ethereal. Limited Production — Setiap piece bernomor.
        </p>
      </div>
    </footer>
  );
}
