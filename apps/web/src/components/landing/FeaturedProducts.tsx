"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { mockProducts, formatRupiah } from "@/lib/mock-products";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * FeaturedProducts — preview 4 produk Heritage Collection.
 * Data diambil dari lib/mock-products.ts (BUKAN hardcode di JSX) supaya swap ke
 * API asli di Milestone 5 tidak perlu bongkar komponen. Kartu reveal berurutan
 * via ScrollTrigger. CTA "Lihat Koleksi Lengkap" mengarah ke /shop (boleh 404
 * dulu — halaman itu cakupan Milestone 5).
 */
export default function FeaturedProducts() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-product-card]", {
          y: 70,
          opacity: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.15,
          scrollTrigger: {
            trigger: "[data-product-grid]",
            start: "top 80%",
          },
        });
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="bg-cream px-6 py-28 text-ink sm:py-40"
      aria-labelledby="featured-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold-dark">
              Koleksi
            </p>
            <h2
              id="featured-heading"
              className="max-w-xl font-serif text-4xl font-light leading-tight sm:text-6xl"
            >
              Heritage Collection
            </h2>
          </div>
          <Link
            href="/shop"
            className="group inline-flex items-center gap-2 self-start text-sm font-medium uppercase tracking-[0.2em] text-ink transition-colors hover:text-gold-dark sm:self-auto"
          >
            Lihat Koleksi Lengkap
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <div
          data-product-grid
          className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4"
        >
          {mockProducts.map((product) => (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              data-product-card
              className="group flex flex-col"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-sm bg-ink-soft">
                <Image
                  src={product.images[0].url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
              <h3 className="mt-5 font-serif text-xl font-medium">
                {product.name}
              </h3>
              <p className="mt-1 text-sm italic leading-relaxed text-ink/60">
                {product.story}
              </p>
              <p className="mt-3 text-sm font-medium tracking-wide text-gold-dark">
                {formatRupiah(product.base_price)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
