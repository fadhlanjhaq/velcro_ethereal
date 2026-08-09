"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { HeroContent } from "@/lib/api";

gsap.registerPlugin(useGSAP);

/**
 * Hero — video background full-bleed + wordmark + tagline, fade-in on load.
 *
 * Teks, video, dan poster datang dari CMS (site_contents section "hero") lewat
 * props; default lama ada di seeder: video /videos/asset_video03.mp4 (landscape
 * 1280x722, mood restoran hangat) dengan poster /images/brand/hero-poster.jpg
 * (frame bersih t=2s dari video yang sama). Semua video sumber punya subtitle
 * auto-caption yang ter-burn-in; di sini di-mask dengan scrim gradient bawah +
 * sedikit skala video. Detail & rekomendasi re-encode dicatat di
 * docs/MILESTONES.md.
 */
export default function Hero({ content }: { content: HeroContent }) {
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
        poster={content.poster_image ?? undefined}
        aria-hidden="true"
      >
        {content.video_url && (
          <source src={content.video_url} type="video/mp4" />
        )}
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
          {content.eyebrow}
        </p>

        <h1 className="font-serif text-cream">
          <span className="sr-only">
            {[content.headline_upright, content.headline_italic]
              .filter(Boolean)
              .join(" ")}
          </span>
          <span
            aria-hidden="true"
            className="flex flex-col leading-[0.9] tracking-tight"
          >
            <span
              data-hero-word
              className="text-6xl font-medium sm:text-8xl lg:text-[9rem]"
            >
              {content.headline_upright}
            </span>
            <span
              data-hero-word
              className="text-6xl font-light italic sm:text-8xl lg:text-[9rem]"
            >
              {content.headline_italic}
            </span>
          </span>
        </h1>

        <p
          data-hero-tagline
          className="mt-8 max-w-md text-balance text-base leading-relaxed text-cream/80 sm:text-lg"
        >
          {content.tagline}
        </p>

        {/* Scroll cue */}
        <div
          data-hero-cue
          className="mt-16 flex flex-col items-center gap-3 text-cream/60"
        >
          <span className="text-[0.65rem] uppercase tracking-[0.3em]">
            {content.scroll_cue}
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
