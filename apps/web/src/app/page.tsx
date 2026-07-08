import Hero from "@/components/landing/Hero";
import BrandStory from "@/components/landing/BrandStory";
import FeaturedProducts from "@/components/landing/FeaturedProducts";
import Craftsmanship from "@/components/landing/Craftsmanship";
import ClosingCta from "@/components/landing/ClosingCta";

/**
 * Landing page Velcro Ethereal (Milestone 4).
 * Prototipe visual frontend murni — tampil sebelum halaman /shop (Milestone 5).
 * Data produk dari lib/mock-products.ts (mock, menunggu API asli).
 */
export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <BrandStory />
      <FeaturedProducts />
      <Craftsmanship />
      <ClosingCta />
    </main>
  );
}
