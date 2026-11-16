"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import type { ProductImage } from "@/lib/api";
import ProductLightbox, { ArrowButton } from "@/components/shop/ProductLightbox";

type EmblaApi = NonNullable<UseEmblaCarouselType[1]>;

/**
 * Carousel foto di halaman detail produk (Embla, tanpa loop).
 *
 * - Swipe/drag di semua ukuran layar. Desktop (lg+): panah kiri/kanan di atas
 *   foto + baris thumbnail. Mobile: penanda "1 / 4" di pojok kanan bawah.
 * - Keyboard: fokus ke carousel lalu ArrowLeft/ArrowRight.
 * - Klik/tap foto → lightbox fullscreen di foto itu. Embla v8 sudah menelan
 *   event click yang terjadi di akhir drag (listener capture di root), jadi
 *   drag tidak ikut membuka lightbox.
 * - 1 foto: tanpa panah, angka, thumbnail, dan drag.
 *
 * Lebar di lg dibatasi dari tinggi viewport (rasio 3/4) supaya foto +
 * thumbnail selalu muat di layar — kolom ini sticky di halaman produk.
 * Dipakai hanya kalau ada ≥ 1 foto; 0 foto ditangani PhotoFallback di page.
 */
export default function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const count = images.length;
  const multiple = count > 1;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    watchDrag: multiple,
  });

  // Nilai awal sudah benar untuk startIndex 0; selanjutnya disinkronkan dari
  // event Embla (select / reInit).
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(multiple);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const regionRef = useRef<HTMLDivElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isFirstSelectRef = useRef(true);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = (api: EmblaApi) => {
      setSelected(api.selectedScrollSnap());
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
    };
    emblaApi.on("select", sync).on("reInit", sync);
    return () => {
      emblaApi.off("select", sync).off("reInit", sync);
    };
  }, [emblaApi]);

  // Thumbnail aktif selalu terlihat di baris yang bisa di-scroll horizontal.
  // Dilewati saat mount supaya halaman tidak ikut bergeser ketika dimuat.
  useEffect(() => {
    if (isFirstSelectRef.current) {
      isFirstSelectRef.current = false;
      return;
    }
    thumbRefs.current[selected]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selected]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!multiple || !emblaApi) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      emblaApi.scrollPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      emblaApi.scrollNext();
    }
  }

  // Saat lightbox ditutup: carousel utama lompat (tanpa animasi) ke foto
  // terakhir yang dilihat di lightbox, dan fokus kembali ke carousel.
  const closeLightbox = useCallback(
    (lastIndex: number) => {
      setLightboxIndex(null);
      emblaApi?.scrollTo(lastIndex, true);
      regionRef.current?.focus({ preventScroll: true });
    },
    [emblaApi],
  );

  return (
    <div className="w-full lg:mx-auto lg:max-w-[calc((100dvh_-_var(--site-header-h,96px)_-_160px)*0.75)]">
      <div
        ref={regionRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={`Galeri foto ${productName}`}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="relative rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
      >
        <div ref={emblaRef} className="overflow-hidden rounded-sm">
          <div className="flex touch-pan-y touch-pinch-zoom">
            {images.map((image, i) => (
              <div
                key={image.url}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} dari ${count}`}
                className="min-w-0 flex-[0_0_100%]"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Perbesar foto ${i + 1}`}
                  className="relative block aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-sm bg-ink-soft"
                >
                  <Image
                    src={image.url}
                    alt={`${productName} — foto ${i + 1}`}
                    fill
                    preload={i === 0}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {multiple && canPrev && (
          <ArrowButton
            direction="prev"
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute left-3 top-1/2 hidden -translate-y-1/2 lg:inline-flex"
          />
        )}
        {multiple && canNext && (
          <ArrowButton
            direction="next"
            onClick={() => emblaApi?.scrollNext()}
            className="absolute right-3 top-1/2 hidden -translate-y-1/2 lg:inline-flex"
          />
        )}

        {multiple && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink/70 px-3 py-1 text-[11px] font-medium tracking-wider text-cream backdrop-blur-sm lg:hidden"
          >
            {selected + 1} / {count}
          </span>
        )}
      </div>

      {multiple && (
        <div className="mt-4 hidden gap-3 overflow-x-auto pb-1 lg:flex">
          {images.map((image, i) => {
            const active = i === selected;
            return (
              <button
                key={image.url}
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`Tampilkan foto ${i + 1}`}
                aria-current={active ? "true" : undefined}
                className={[
                  "relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-sm border bg-ink-soft transition-opacity",
                  active
                    ? "border-gold"
                    : "border-transparent opacity-60 hover:opacity-100",
                ].join(" ")}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <ProductLightbox
          images={images}
          productName={productName}
          startIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
}
