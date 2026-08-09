"use client";

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { ClosingCtaContent } from "@/lib/api";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * ClosingCta — CTA penutup sederhana. Reveal saat masuk viewport.
 * Copy dan tujuan tombol dikelola lewat CMS (site_contents section
 * "closing_cta"); default seeder mengarah ke /shop.
 */
export default function ClosingCta({
  content,
}: {
  content: ClosingCtaContent;
}) {
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
          scrollTrigger: {
            trigger: root.current,
            start: "top 75%",
            toggleActions: "play reverse play reverse",
          },
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
        {content.eyebrow}
      </p>
      <h2
        data-cta-reveal
        className="max-w-2xl font-serif text-4xl font-light italic leading-tight text-cream sm:text-6xl"
      >
        {content.heading}
      </h2>
      <p
        data-cta-reveal
        className="mt-6 max-w-md text-base leading-relaxed text-cream/70"
      >
        {content.secondary_line}
      </p>
      <Link
        data-cta-reveal
        href={content.cta_href ?? "/shop"}
        className="mt-12 inline-flex items-center gap-3 rounded-full border border-gold px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors duration-300 hover:bg-gold hover:text-ink"
      >
        {content.cta_label}
        <span aria-hidden="true">→</span>
      </Link>
      {/* Baris copyright dipindah ke Footer global (Milestone 6) agar tidak dobel. */}
    </section>
  );
}
