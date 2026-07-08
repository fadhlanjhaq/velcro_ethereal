"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Hero — video background full-bleed + wordmark + tagline, fade-in on load.
 *
 * Aset video: /videos/asset_video03.mp4 (landscape 1280x722, mood restoran
 * hangat — paling sinematik & "brand film" dari 4 video yang ada). Poster
 * fallback: /images/brand/hero-poster.jpg (frame bersih t=2s dari video yang
 * sama). Semua video sumber punya subtitle auto-caption yang ter-burn-in; di
 * sini di-mask dengan scrim gradient bawah + sedikit skala video. Detail &
 * rekomendasi re-encode dicatat di docs/MILESTONES.md.
 */
export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // Animasi hanya jalan kalau user tidak minta reduced-motion.
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out", duration: 1.2 },
        });
        tl.from("[data-hero-eyebrow]", { opacity: 0, y: 20 })
          .from(
            "[data-hero-word]",
            { opacity: 0, yPercent: 40, stagger: 0.12, duration: 1.4 },
            "-=0.8",
          )
          .from("[data-hero-tagline]", { opacity: 0, y: 20 }, "-=0.9")
          .from("[data-hero-cue]", { opacity: 0, duration: 1 }, "-=0.5");

        // Kelvin cue berkedip halus.
        gsap.to("[data-hero-cue-line]", {
          scaleY: 0.4,
          transformOrigin: "top center",
          repeat: -1,
          yoyo: true,
          duration: 1.4,
          ease: "sine.inOut",
        });
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex h-svh min-h-[640px] w-full items-center justify-center overflow-hidden"
    >
      {/* Video background */}
      <video
        className="absolute inset-0 h-full w-full scale-105 object-cover"
        autoPlay
        muted
        loop
        playsInline
        poster="/images/brand/hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/videos/asset_video03.mp4" type="video/mp4" />
      </video>

      {/* Scrim: tint keseluruhan + gradient atas & bawah. Gradient bawah
          sekaligus menyamarkan subtitle bawaan video. */}
      <div className="absolute inset-0 bg-ink/45" aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink"
        aria-hidden="true"
      />

      {/* Konten */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <p
          data-hero-eyebrow
          className="mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold sm:text-sm"
        >
          Heritage Collection — 2026
        </p>

        <h1 className="font-serif text-cream">
          <span className="sr-only">Velcro Ethereal</span>
          <span
            aria-hidden="true"
            className="flex flex-col leading-[0.9] tracking-tight"
          >
            <span
              data-hero-word
              className="text-6xl font-medium sm:text-8xl lg:text-[9rem]"
            >
              Velcro
            </span>
            <span
              data-hero-word
              className="text-6xl font-light italic sm:text-8xl lg:text-[9rem]"
            >
              Ethereal
            </span>
          </span>
        </h1>

        <p
          data-hero-tagline
          className="mt-8 max-w-md text-balance text-base leading-relaxed text-cream/80 sm:text-lg"
        >
          Bordir tangan, ditenun dari warisan — pakaian yang dirancang untuk
          melampaui musim.
        </p>

        {/* Scroll cue */}
        <div
          data-hero-cue
          className="mt-16 flex flex-col items-center gap-3 text-cream/60"
        >
          <span className="text-[0.65rem] uppercase tracking-[0.3em]">
            Gulir
          </span>
          <span
            data-hero-cue-line
            className="block h-10 w-px bg-gradient-to-b from-gold to-transparent"
          />
        </div>
      </div>
    </section>
  );
}
