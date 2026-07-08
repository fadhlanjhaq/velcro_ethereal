"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Daftarkan ScrollTrigger sekali di sisi client. Aman dipanggil berulang.
gsap.registerPlugin(ScrollTrigger);

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

    // Lenis memberi tahu ScrollTrigger setiap kali posisi scroll berubah.
    lenis.on("scroll", ScrollTrigger.update);

    // Gerakkan Lenis dari ticker GSAP (satu clock untuk semuanya).
    const raf = (time: number) => {
      lenis.raf(time * 1000); // gsap.ticker pakai detik, Lenis pakai milidetik
    };
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
