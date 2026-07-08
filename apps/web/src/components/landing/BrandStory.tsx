"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * BrandStory — 3 pilar brand (Heritage / Artisan / Eternal).
 * Headline pakai SplitText (stagger per kata) di-trigger saat masuk viewport;
 * tiap pilar reveal berurutan via ScrollTrigger.
 *
 * NB: copy pilar masih placeholder (asumsi dari brand DNA), pending konfirmasi.
 */
const PILLARS = [
  {
    index: "01",
    title: "Heritage",
    body: "Setiap simpul bordir membawa cerita — motif yang diwariskan turun-temurun, bukan sekadar hiasan permukaan.",
  },
  {
    index: "02",
    title: "Artisan",
    body: "Dikerjakan dengan tangan oleh para pengrajin. Waktu dan ketelitian, bukan mesin, yang menentukan mutunya.",
  },
  {
    index: "03",
    title: "Eternal",
    body: "Dibuat untuk melampaui tren. Pakaian yang menua dengan anggun dan tetap relevan lintas musim.",
  },
];

export default function BrandStory() {
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Headline: SplitText per kata, reveal saat section masuk viewport.
        const split = new SplitText(heading.current, { type: "words" });
        gsap.from(split.words, {
          yPercent: 120,
          opacity: 0,
          duration: 1,
          ease: "power4.out",
          stagger: 0.12,
          scrollTrigger: {
            trigger: heading.current,
            start: "top 80%",
          },
        });

        // Pilar: reveal berurutan.
        gsap.from("[data-pillar]", {
          y: 60,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.18,
          scrollTrigger: {
            trigger: "[data-pillar-grid]",
            start: "top 78%",
          },
        });

        // Bersihkan SplitText saat komponen di-revert.
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative bg-ink px-6 py-28 sm:py-40"
      aria-labelledby="brandstory-heading"
    >
      <div className="mx-auto max-w-6xl">
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold">
          Filosofi
        </p>
        <h2
          id="brandstory-heading"
          ref={heading}
          className="max-w-3xl font-serif text-4xl font-light leading-tight text-cream sm:text-6xl"
        >
          Tiga prinsip yang menjahit setiap helai.
        </h2>

        <div
          data-pillar-grid
          className="mt-20 grid gap-px overflow-hidden rounded-sm border border-gold/15 bg-gold/15 sm:grid-cols-3"
        >
          {PILLARS.map((pillar) => (
            <article
              key={pillar.title}
              data-pillar
              className="flex flex-col gap-5 bg-ink p-8 sm:p-10"
            >
              <span className="font-serif text-sm text-gold">
                {pillar.index}
              </span>
              <h3 className="font-serif text-3xl font-medium text-cream">
                {pillar.title}
              </h3>
              <p className="text-sm leading-relaxed text-cream/70">
                {pillar.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
