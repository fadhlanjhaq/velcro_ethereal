"use client";

import { useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Craftsmanship — section mood/tekstur dengan parallax ringan (scrub).
 * Foto: /images/brand/asset_06.jpg (mood) + /images/product/asset_05.jpg
 * (tekstur rajut, detail craftsmanship). Parallax dinonaktifkan otomatis saat
 * reduced-motion (gambar tetap tampil statis, tidak disembunyikan).
 */
export default function Craftsmanship() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Tiap layer parallax bergerak sesuai atribut data-speed-nya.
        const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]");
        layers.forEach((layer) => {
          const shift = Number(layer.dataset.parallax) || 6;
          gsap.fromTo(
            layer,
            { yPercent: -shift },
            {
              yPercent: shift,
              ease: "none",
              scrollTrigger: {
                trigger: layer,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );
        });

        // Teks reveal saat masuk viewport.
        gsap.from("[data-craft-reveal]", {
          y: 50,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: "[data-craft-copy]",
            start: "top 80%",
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
      id="craftsmanship"
      className="overflow-hidden scroll-mt-24 bg-ink px-6 py-28 sm:py-40"
      aria-labelledby="craft-heading"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        {/* Kolom foto mood — parallax */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
          <div data-parallax="7" className="absolute -inset-y-[12%] inset-x-0">
            <Image
              src="/images/brand/asset_06.jpg"
              alt="Suasana koleksi Velcro Ethereal"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div
            className="absolute inset-0 bg-ink/20"
            aria-hidden="true"
          />
        </div>

        {/* Kolom teks + inset tekstur */}
        <div data-craft-copy className="flex flex-col">
          <p
            data-craft-reveal
            className="mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold"
          >
            Craftsmanship
          </p>
          <h2
            id="craft-heading"
            data-craft-reveal
            className="font-serif text-4xl font-light leading-tight text-cream sm:text-5xl"
          >
            Ditenun perlahan, dijahit untuk bertahan.
          </h2>
          <p
            data-craft-reveal
            className="mt-6 max-w-md text-base leading-relaxed text-cream/70"
          >
            Setiap potong melewati tangan pengrajin — dari benang yang dipilih,
            simpul yang diikat, hingga bordir yang menutup cerita. Bukan produksi
            massal, melainkan waktu yang dijahitkan ke dalam kain.
          </p>

          {/* Inset tekstur close-up — parallax lebih halus */}
          <div
            data-craft-reveal
            className="relative mt-10 aspect-[16/10] max-w-sm overflow-hidden rounded-sm"
          >
            <div
              data-parallax="4"
              className="absolute -inset-y-[10%] inset-x-0"
            >
              <Image
                src="/images/product/asset_05.jpg"
                alt="Detail tekstur rajut"
                fill
                sizes="(max-width: 1024px) 100vw, 24rem"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
