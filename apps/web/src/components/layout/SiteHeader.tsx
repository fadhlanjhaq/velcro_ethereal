"use client";

import Link from "next/link";
import { useCart } from "@/context/CartContext";

/**
 * Header/nav minimal global — wordmark (→ landing) + ikon keranjang dengan badge
 * jumlah item (dari CartContext). Fixed di atas semua halaman. Belum ada
 * komponen header sebelum ini (landing Milestone 4 tanpa nav), jadi dibuat baru.
 */
export default function SiteHeader() {
  const { count } = useCart();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-cream/10 bg-ink/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-serif text-sm font-medium uppercase tracking-[0.35em] text-cream transition-colors hover:text-gold"
        >
          Velcro&nbsp;Ethereal
        </Link>

        <Link
          href="/cart"
          className="group relative inline-flex items-center gap-2 text-cream transition-colors hover:text-gold"
          aria-label={`Keranjang${count > 0 ? `, ${count} item` : ""}`}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          {count > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-semibold text-ink">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
