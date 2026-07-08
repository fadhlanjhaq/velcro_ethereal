import Hero from "@/components/landing/Hero";
import BrandStory from "@/components/landing/BrandStory";
import FeaturedProducts from "@/components/landing/FeaturedProducts";
import Craftsmanship from "@/components/landing/Craftsmanship";
import ClosingCta from "@/components/landing/ClosingCta";
import { getProducts } from "@/lib/api";

/**
 * Landing page Velcro Ethereal.
 * Server Component: fetch produk asli dari API Laravel (lib/api.ts, Milestone 5)
 * dan oper ke FeaturedProducts sebagai props — tidak ada lagi mock data runtime,
 * dan client component tidak fetch sendiri via useEffect.
 */
export default async function Home() {
  const products = await getProducts();

  return (
    <main className="flex-1">
      <Hero />
      <BrandStory />
      <FeaturedProducts products={products} />
      <Craftsmanship />
      <ClosingCta />
    </main>
  );
}
