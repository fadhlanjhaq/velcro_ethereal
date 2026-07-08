"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * ClosingCta — CTA penutup sederhana. Reveal saat masuk viewport.
 * Copy masih placeholder. Tombol mengarah ke /shop (Milestone 5, boleh 404).
 */
export default function ClosingCta() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-cta-reveal]", {
          y: 40,
          opacity: 0,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: { trigger: root.current, start: "top 75%" },
        });
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex flex-col items-center bg-ink px-6 py-28 text-center sm:py-44"
    >
      <p
        data-cta-reveal
        className="mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold"
      >
        Velcro Ethereal
      </p>
      <h2
        data-cta-reveal
        className="max-w-2xl font-serif text-4xl font-light leading-tight text-cream sm:text-6xl"
      >
        Kenakan warisan yang dirancang untuk abadi.
      </h2>
      <p
        data-cta-reveal
        className="mt-6 max-w-md text-base leading-relaxed text-cream/70"
      >
        Jumlah terbatas per motif. Setiap potong bernomor, tak terulang.
      </p>
      <Link
        data-cta-reveal
        href="/shop"
        className="mt-12 inline-flex items-center gap-3 rounded-full border border-gold px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors duration-300 hover:bg-gold hover:text-ink"
      >
        Jelajahi Koleksi
        <span aria-hidden="true">→</span>
      </Link>

      <p
        data-cta-reveal
        className="mt-20 text-xs uppercase tracking-[0.3em] text-cream/40"
      >
        © 2026 Velcro Ethereal
      </p>
    </section>
  );
}
