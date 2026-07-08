"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * BrandStory — 3 pilar brand (Heritage / Artisan / Eternal).
 * Headline pakai SplitText (stagger per kata, masked reveal) di-trigger saat
 * masuk viewport; tiap pilar reveal berurutan (y + fade + scale-in) via
 * ScrollTrigger, plus micro-interaction hover (garis gold "digambar").
 *
 * ── Catatan diagnosis (Milestone 6, Bagian B) ────────────────────────────────
 * Laporan "section terasa statis" DIDIAGNOSIS lebih dulu:
 *  1. Guard reduced-motion di sini SUDAH BENAR (bukan logic terbalik): animasi
 *     hanya jalan pada "(prefers-reduced-motion: no-preference)". Konsekuensinya,
 *     kalau OS/browser meng-aktifkan Reduce Motion (macOS: System Settings →
 *     Accessibility → Display → Reduce Motion), SELURUH animasi section ini
 *     memang sengaja tidak jalan — ini tersangka utama "statis", bukan bug.
 *     (Verifikasi Milestone 4 dulu pakai Chrome --force-prefers-reduced-motion,
 *     jadi screenshot itu memang tidak mewakili animasi yang sebenarnya.)
 *  2. Start ScrollTrigger ("top 80%") sudah wajar; yang kurang "kelihatan" dulu
 *     adalah headline yang slide TANPA mask (efeknya samar) dan card yang minim
 *     depth. Di bawah: masked reveal per kata + card scale-in + hover.
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
        // Headline: SplitText per kata dengan MASK per kata (tiap kata slide dari
        // balik klip-box-nya) — reveal jauh lebih tegas & premium dibanding slide
        // tanpa mask. Stagger per kata jelas, easing power4.out.
        const split = new SplitText(heading.current, {
          type: "words",
          mask: "words",
        });
        gsap.from(split.words, {
          yPercent: 110,
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.09,
          scrollTrigger: {
            trigger: heading.current,
            start: "top 85%",
          },
        });

        // Pilar: reveal berurutan (stagger antar card) — translate-y + fade +
        // scale-in halus untuk depth. Start sedikit lebih awal biar tidak
        // "kelewat" saat scroll cepat.
        gsap.from("[data-pillar]", {
          y: 64,
          opacity: 0,
          scale: 0.96,
          transformOrigin: "center bottom",
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.16,
          scrollTrigger: {
            trigger: "[data-pillar-grid]",
            start: "top 82%",
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
      id="filosofi"
      className="relative scroll-mt-24 bg-ink px-6 py-28 sm:py-40"
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
              className="group relative flex flex-col gap-5 bg-ink p-8 transition-colors duration-500 hover:bg-ink-soft sm:p-10"
            >
              {/* Micro-interaction: garis gold tipis "digambar" dari kiri saat
                  hover — detail kecil khas situs brand premium. */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gold transition-transform duration-500 ease-out group-hover:scale-x-100"
              />
              <span className="font-serif text-sm text-gold transition-colors duration-500 group-hover:text-gold/90">
                {pillar.index}
              </span>
              <h3 className="font-serif text-3xl font-medium text-cream transition-transform duration-500 ease-out group-hover:translate-x-1">
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
