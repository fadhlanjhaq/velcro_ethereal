"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Daftarkan ScrollTrigger sekali di sisi client. Aman dipanggil berulang.
gsap.registerPlugin(ScrollTrigger);

/** Nilai bawaan gsap.ticker (lihat _lagThreshold / _adjustedLag di gsap-core).
 *  Dipakai memulihkan lagSmoothing saat provider unmount, supaya setelan yang
 *  kita ubah tidak bocor jadi mutasi global yang hidup lebih lama dari provider. */
const GSAP_DEFAULT_LAG_THRESHOLD = 500;
const GSAP_DEFAULT_ADJUSTED_LAG = 33;

const LenisContext = createContext<React.RefObject<Lenis | null> | null>(
  null,
);

/**
 * Akses instance Lenis yang sedang aktif (mis. dari SiteHeader untuk
 * scroll-to-section pada anchor link nav, supaya konsisten smooth-scroll
 * dan tidak native jump). Mengembalikan null di luar provider, atau ref
 * dengan `.current === null` kalau reduced-motion aktif / belum mount —
 * caller wajib fallback ke `scrollIntoView` native di kondisi itu.
 */
export function useLenis() {
  return useContext(LenisContext);
}

/**
 * Wrapper smooth-scroll (Lenis) yang disinkronkan dengan GSAP ScrollTrigger.
 *
 * Ini adalah setup infrastruktur (raf loop + integrasi ticker), BUKAN animasi
 * GSAP — jadi useEffect tepat di sini; useGSAP dipakai di komponen yang benar-
 * benar membuat tween. Pola integrasi Lenis+GSAP ini mengikuti dokumentasi
 * resmi GSAP: Lenis menggerakkan scroll, lalu memberitahu ScrollTrigger tiap
 * frame lewat gsap.ticker sehingga animasi scroll-linked tetak presisi.
 *
 * Reduced-motion: kalau user minta motion dikurangi, Lenis TIDAK dinisialisasi
 * sama sekali — browser memakai native scroll biasa.
 */
export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      // Tetap pastikan ScrollTrigger memakai scroll native.
      ScrollTrigger.refresh();
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Lenis memberi tahu ScrollTrigger setiap kali posisi scroll berubah.
    lenis.on("scroll", ScrollTrigger.update);

    // Gerakkan Lenis dari ticker GSAP (satu clock untuk semuanya).
    const raf = (time: number) => {
      lenis.raf(time * 1000); // gsap.ticker pakai detik, Lenis pakai milidetik
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off("scroll", ScrollTrigger.update);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(
        GSAP_DEFAULT_LAG_THRESHOLD,
        GSAP_DEFAULT_ADJUSTED_LAG,
      );
      lenisRef.current = null;
      lenis.destroy();
    };
  }, []);

  /**
   * Sinkronisasi ulang saat route berubah (navigasi client-side App Router).
   *
   * Instance Lenis di atas dibuat SEKALI dan hidup selama route group (main)
   * — layout tidak remount saat pindah halaman. Tanpa efek ini, Lenis membawa
   * "keyakinan" posisi & tinggi halaman lama ke halaman baru:
   *
   *  - Animasi smooth yang masih terbang saat navigasi terus menulis paksa
   *    posisi scroll browser tiap frame (Lenis onUpdate → setScroll), dan
   *    selama isScrolling === "smooth" event scroll native DIABAIKAN sehingga
   *    Lenis tidak pernah menyesuaikan diri ke posisi sebenarnya.
   *  - `limit` (batas scroll) hanya dihitung ulang lewat ResizeObserver yang
   *    ber-debounce, jadi sempat basi saat pindah antar halaman yang tingginya
   *    beda jauh.
   *
   * URUTAN PENTING: scrollTo(immediate) dulu, baru resize(). scrollTo dengan
   * `immediate` adalah satu-satunya jalur PUBLIK yang menghentikan animasi
   * in-flight (di dalamnya memanggil reset() yang private). Kalau resize()
   * didahulukan, ia menyamakan targetScroll dengan posisi aktual, lalu
   * scrollTo kena early-return `target === targetScroll` dan animasinya TIDAK
   * jadi dihentikan.
   */
  useEffect(() => {
    const lenis = lenisRef.current;

    if (lenis) {
      // Hentikan animasi in-flight + samakan posisi internal ke posisi asli.
      lenis.scrollTo(window.scrollY, { immediate: true, force: true });
      lenis.resize();
    }

    // Tunggu dua frame supaya DOM halaman baru (dan pergeseran layout dari
    // gambar/font) sudah settle sebelum ScrollTrigger menghitung start/end.
    // resize() diulang di sini karena scrollTo(immediate) menelan satu event
    // scroll native berikutnya (preventNextNativeScrollEvent) — yang bisa jadi
    // justru event reset-scroll dari router.
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        lenisRef.current?.resize();
        ScrollTrigger.refresh();
      });
    });

    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [pathname]);

  return (
    <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
  );
}
