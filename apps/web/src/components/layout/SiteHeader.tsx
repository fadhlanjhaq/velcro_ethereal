"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useLenis } from "@/components/SmoothScrollProvider";
import {
  CollectionsAccordionMobile,
  CollectionsDropdownDesktop,
} from "@/components/layout/CollectionsNav";

/**
 * MARKETPLACE & KONTAK belum punya halaman/tujuan nyata (di luar cakupan
 * milestone ini) — sengaja dibuat non-navigasi (bukan href="#" polos yang
 * melompat ke atas halaman) daripada broken link atau dead anchor jump.
 */
const PLACEHOLDER_NAV_ITEMS = ["Marketplace", "Kontak"] as const;

const navLinkClass =
  "font-jost text-xs font-medium uppercase tracking-[0.25em] text-cream/80 transition-colors hover:text-gold";
const navPlaceholderClass =
  "font-jost cursor-default text-xs font-medium uppercase tracking-[0.25em] text-cream/40";

export default function SiteHeader() {
  const { count } = useCart();
  const pathname = usePathname();
  const lenisRef = useLenis();
  const headerRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = pathname === "/";

  function handleSectionLink(
    event: React.MouseEvent<HTMLAnchorElement>,
    hash: string,
  ) {
    setMobileOpen(false);

    // Bukan di homepage → biarkan navigasi default ke "/#hash", browser akan
    // jump ke section itu setelah halaman baru selesai load.
    if (!isHome) return;

    const target = document.getElementById(hash);
    if (!target) return;
    event.preventDefault();

    // Offset dihitung dari tinggi header aktual (announcement bar bisa wrap
    // jadi 2 baris di layar sempit) supaya section tidak ketutup fixed header.
    const offset = -((headerRef.current?.offsetHeight ?? 96) + 16);

    if (lenisRef?.current) {
      lenisRef.current.scrollTo(target, { offset });
    } else {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50">
      {/* Announcement bar */}
      <div className="border-b border-gold/15 bg-ink-soft/90 backdrop-blur-md">
        <p className="font-jost mx-auto max-w-6xl px-4 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-cream/50 sm:px-6 sm:text-xs sm:tracking-[0.25em]">
          Worldwide Shipping
          <span aria-hidden="true" className="mx-2 text-gold/40">
            ·
          </span>
          Limited Production
          <span aria-hidden="true" className="mx-2 text-gold/40">
            ·
          </span>
          Authenticity Guaranteed for Every Piece
        </p>
      </div>

      {/* Nav utama */}
      <div className="border-b border-cream/10 bg-ink/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/"
            className="font-serif text-base font-bold uppercase tracking-[0.18em] text-cream transition-colors hover:text-gold sm:text-xl sm:tracking-[0.3em] lg:text-2xl lg:tracking-[0.35em]"
          >
            Velcro&nbsp;Ethereal
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <CollectionsDropdownDesktop
              triggerClassName={navLinkClass}
              onSectionLink={handleSectionLink}
            />
            {PLACEHOLDER_NAV_ITEMS.map((label) => (
              <a
                key={label}
                href="#"
                onClick={(event) => event.preventDefault()}
                aria-disabled="true"
                title="Segera hadir"
                className={navPlaceholderClass}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 text-cream transition-colors hover:border-gold hover:text-gold"
              aria-label={`Keranjang${count > 0 ? `, ${count} item` : ""}`}
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {count > 0 && (
                <span className="font-jost absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-semibold text-ink">
                  {count}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 text-cream transition-colors hover:border-gold hover:text-gold lg:hidden"
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
                {mobileOpen ? (
                  <path d="M18 6 6 18M6 6l12 12" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="flex flex-col border-t border-cream/10 bg-ink px-6 py-4 lg:hidden">
            <CollectionsAccordionMobile
              triggerClassName={`${navLinkClass} py-3`}
              onSectionLink={handleSectionLink}
            />
            {PLACEHOLDER_NAV_ITEMS.map((label) => (
              <a
                key={label}
                href="#"
                onClick={(event) => event.preventDefault()}
                aria-disabled="true"
                title="Segera hadir"
                className={`${navPlaceholderClass} py-3`}
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
