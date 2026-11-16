"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import type { ProductImage } from "@/lib/api";
import { useLenis } from "@/components/SmoothScrollProvider";

type EmblaApi = NonNullable<UseEmblaCarouselType[1]>;

/**
 * Lightbox fullscreen foto produk — instance Embla sendiri, mulai dari foto
 * yang diklik di carousel utama.
 *
 * Tutup: tombol X, Escape, atau klik area kosong di sekitar foto (termasuk
 * letterbox object-contain — dihitung dari ukuran foto yang benar-benar
 * tampil, bukan kotak <img>). Navigasi: panah (desktop), swipe, ArrowLeft/
 * ArrowRight. Tanpa zoom kustom.
 *
 * Hanya di-mount setelah klik (tidak pernah saat SSR), jadi aman langsung
 * createPortal ke document.body. Selama terbuka, scroll halaman dikunci
 * (Lenis stop + overflow hidden) dan dipulihkan saat unmount.
 *
 * `onClose` menerima index foto terakhir yang dilihat, supaya carousel utama
 * bisa ikut lompat ke foto itu.
 */
export default function ProductLightbox({
  images,
  productName,
  startIndex,
  onClose,
}: {
  images: ProductImage[];
  productName: string;
  startIndex: number;
  onClose: (lastIndex: number) => void;
}) {
  const count = images.length;
  const multiple = count > 1;
  const lenisRef = useLenis();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    startIndex,
    watchDrag: multiple,
  });

  // Nilai awal sesuai startIndex; selanjutnya dari event Embla.
  const [selected, setSelected] = useState(startIndex);
  const [canPrev, setCanPrev] = useState(startIndex > 0);
  const [canNext, setCanNext] = useState(startIndex < count - 1);

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

  // Kunci scroll halaman selama lightbox terbuka.
  useEffect(() => {
    const lenis = lenisRef?.current;
    lenis?.stop();
    document.documentElement.style.overflow = "hidden";
    return () => {
      lenis?.start();
      document.documentElement.style.overflow = "";
    };
  }, [lenisRef]);

  // Fokus ke tombol X saat dibuka.
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  function close() {
    onClose(emblaApi?.selectedScrollSnap() ?? selected);
  }

  // Keyboard di level document (fokus bisa di mana saja di dalam dialog).
  // `close` dibaca lewat ref supaya listener tidak dipasang ulang tiap render.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        emblaApi?.scrollPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        emblaApi?.scrollNext();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [emblaApi]);

  // Klik di slide: tutup hanya kalau di luar area foto yang tampil. Klik di
  // akhir drag sudah ditelan Embla, jadi swipe tidak menutup lightbox.
  function handleSlideClick(event: React.MouseEvent<HTMLDivElement>) {
    const img = event.currentTarget.querySelector("img");
    if (!img || !isInsideRenderedImage(img, event.clientX, event.clientY)) {
      close();
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${productName}`}
      className="fixed inset-0 z-[70] bg-ink/95 text-cream"
    >
      <div ref={emblaRef} className="absolute inset-0 overflow-hidden">
        <div className="flex h-full touch-pan-y touch-pinch-zoom">
          {images.map((image, i) => (
            <div
              key={image.url}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} dari ${count}`}
              onClick={handleSlideClick}
              className="relative h-full min-w-0 flex-[0_0_100%] px-4 py-16 lg:px-24"
            >
              <div className="relative h-full w-full">
                <Image
                  src={image.url}
                  alt={`${productName} — foto ${i + 1}`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="absolute left-4 top-4 z-10 text-xs font-medium tracking-wider text-cream/80 lg:left-6 lg:top-6">
        {selected + 1} / {count}
      </p>

      <button
        ref={closeButtonRef}
        type="button"
        onClick={close}
        aria-label="Tutup"
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/20 bg-ink/60 text-cream backdrop-blur-md transition-colors hover:border-gold hover:text-gold lg:right-6 lg:top-6"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {multiple && canPrev && (
        <ArrowButton
          direction="prev"
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute left-6 top-1/2 hidden -translate-y-1/2 lg:inline-flex"
        />
      )}
      {multiple && canNext && (
        <ArrowButton
          direction="next"
          onClick={() => emblaApi?.scrollNext()}
          className="absolute right-6 top-1/2 hidden -translate-y-1/2 lg:inline-flex"
        />
      )}
    </div>,
    document.body,
  );
}

/**
 * Apakah titik (x, y) jatuh di foto yang benar-benar tampil? Dengan
 * object-contain, kotak <img> memenuhi container tapi fotonya bisa
 * ber-letterbox; area letterbox dianggap "area kosong". Kalau ukuran asli
 * foto belum diketahui (belum termuat), seluruh kotak dianggap foto.
 */
function isInsideRenderedImage(
  img: HTMLImageElement,
  x: number,
  y: number,
): boolean {
  const box = img.getBoundingClientRect();
  let width = box.width;
  let height = box.height;

  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    const imageRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = box.width / box.height;
    if (imageRatio > boxRatio) {
      height = box.width / imageRatio;
    } else {
      width = box.height * imageRatio;
    }
  }

  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

/** Tombol panah bulat — dipakai carousel utama dan lightbox. */
export function ArrowButton({
  direction,
  onClick,
  className = "",
}: {
  direction: "prev" | "next";
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Foto sebelumnya" : "Foto berikutnya"}
      className={[
        "z-10 h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-ink/60 text-cream backdrop-blur-md transition-colors hover:border-gold hover:text-gold",
        className,
      ].join(" ")}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={direction === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}
