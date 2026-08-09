import type { Metadata } from "next";
import Hero from "@/components/landing/Hero";
import BrandStory from "@/components/landing/BrandStory";
import FeaturedProducts from "@/components/landing/FeaturedProducts";
import Craftsmanship from "@/components/landing/Craftsmanship";
import ClosingCta from "@/components/landing/ClosingCta";
import { getProducts, getSiteContent } from "@/lib/api";

export const metadata: Metadata = {
  title: "Velcro Ethereal",
};

/**
 * Landing page Velcro Ethereal.
 * Server Component: fetch produk asli dan konten section dari API Laravel
 * (lib/api.ts) lalu oper ke komponen sebagai props — tidak ada lagi mock data
 * atau copy hardcode, dan client component tidak fetch sendiri via useEffect.
 *
 * getSiteContent() juga dipanggil di (main)/layout.tsx untuk announcement bar;
 * cache() React membuat keduanya berbagi satu HTTP call per request.
 */
export default async function Home() {
  const [products, content] = await Promise.all([
    getProducts(),
    getSiteContent(),
  ]);

  return (
    <main className="flex-1">
      <Hero content={content.hero} />
      <BrandStory content={content.brand_story} />
      <FeaturedProducts products={products} />
      <Craftsmanship content={content.craftsmanship} />
      <ClosingCta content={content.closing_cta} />
    </main>
  );
}
