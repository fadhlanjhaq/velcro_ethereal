"use client";

import Link from "next/link";
import { useRef, useState } from "react";

/**
 * Kategori dropdown "Collections" — PLACEHOLDER. Semua kategori mengarah ke
 * anchor `/#koleksi` yang sama (belum ada halaman/filter per kategori nyata).
 * Bentuk `{ label, hash }` sengaja meniru shape `SECTION_NAV_ITEMS` di
 * SiteHeader.tsx supaya kompatibel langsung dengan `handleSectionLink` yang
 * sudah ada (smooth-scroll via Lenis + fallback antar-halaman) tanpa logic
 * terpisah. Saat kategori asli dari Filament sudah ada (kemungkinan besar
 * jadi filter query, mis. `/shop?category=jackets`), array ini tinggal
 * diganti sumbernya (fetch/props) — konsumen di bawah (dropdown desktop +
 * accordion mobile) tidak perlu diubah selama shape `{ label, hash }`
 * dipertahankan atau di-adapt tipis.
 */
export const COLLECTION_CATEGORIES = [
  { label: "Jackets", hash: "koleksi" },
  { label: "Knitwear", hash: "koleksi" },
  { label: "Pants", hash: "koleksi" },
  { label: "Footwear & Accessories", hash: "koleksi" },
] as const;

/** Jeda sebelum dropdown desktop menutup saat mouse keluar dari trigger —
 * cukup lama supaya mouse yang bergerak diagonal dari trigger ke panel
 * tidak keburu menutup dropdown-nya sendiri. */
const CLOSE_DELAY_MS = 180;

type SectionLinkHandler = (
  event: React.MouseEvent<HTMLAnchorElement>,
  hash: string,
) => void;

const dropdownItemClass =
  "font-jost block px-4 py-2.5 text-xs uppercase tracking-[0.15em] text-cream/80 transition-colors hover:bg-gold/10 hover:text-gold";

export function CollectionsDropdownDesktop({
  triggerClassName,
  onSectionLink,
}: {
  triggerClassName: string;
  onSectionLink: SectionLinkHandler;
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <Link
        href="/#koleksi"
        onClick={(event) => onSectionLink(event, "koleksi")}
        className={triggerClassName}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Collections
      </Link>

      <div
        className={`absolute left-1/2 top-full z-10 w-56 -translate-x-1/2 pt-3 transition-all duration-200 ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible -translate-y-1 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-sm border border-gold/25 bg-ink shadow-lg shadow-black/40">
          {COLLECTION_CATEGORIES.map((category) => (
            <Link
              key={category.label}
              href={`/#${category.hash}`}
              onClick={(event) => onSectionLink(event, category.hash)}
              className={dropdownItemClass}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CollectionsAccordionMobile({
  triggerClassName,
  onSectionLink,
}: {
  triggerClassName: string;
  onSectionLink: SectionLinkHandler;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          href="/#koleksi"
          onClick={(event) => onSectionLink(event, "koleksi")}
          className={triggerClassName}
        >
          Collections
        </Link>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? "Tutup kategori Collections" : "Buka kategori Collections"}
          className="flex h-8 w-8 items-center justify-center text-cream/70 transition-colors hover:text-gold"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="ml-1 flex flex-col border-l border-gold/20 pl-4">
          {COLLECTION_CATEGORIES.map((category) => (
            <Link
              key={category.label}
              href={`/#${category.hash}`}
              onClick={(event) => onSectionLink(event, category.hash)}
              className="font-jost py-2.5 text-xs uppercase tracking-[0.15em] text-cream/60 transition-colors hover:text-gold"
            >
              {category.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
