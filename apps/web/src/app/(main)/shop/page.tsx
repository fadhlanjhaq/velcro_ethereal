import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getProducts, formatRupiah } from "@/lib/api";
import PhotoFallback from "@/components/shop/PhotoFallback";

export const metadata: Metadata = {
  title: "Shop — Velcro Ethereal",
  description:
    "Katalog lengkap Heritage Collection — jaket dengan bordir artisanal.",
};

/**
 * /shop — Server Component. Fetch produk asli dari API Laravel (lib/api.ts) dan
 * render grid. Memakai design tokens Milestone 4 (globals.css @theme). Produk
 * tanpa foto (images kosong) menampilkan PhotoFallback yang jujur, bukan gambar
 * rusak.
 */
export default async function ShopPage() {
  const products = await getProducts();

  return (
    <main className="flex-1 bg-ink px-6 py-28 text-cream sm:py-36">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.4em] text-gold">
            Koleksi
          </p>
          <h1 className="font-serif text-5xl font-light leading-tight sm:text-7xl">
            Heritage Collection
          </h1>
          <p className="mt-6 text-base leading-relaxed text-cream/70">
            Jaket dengan bordir artisanal — setiap motif diproduksi dalam jumlah
            terbatas.
          </p>
        </header>

        <div className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              className="group flex flex-col"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-sm bg-ink-soft">
                {product.images.length > 0 ? (
                  <Image
                    src={product.images[0].url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                ) : (
                  <PhotoFallback />
                )}
              </div>
              <h2 className="mt-5 font-serif text-xl font-medium">
                {product.name}
              </h2>
              <p className="mt-1 text-sm italic leading-relaxed text-cream/60">
                {product.story}
              </p>
              <p className="mt-3 text-sm font-medium tracking-wide text-gold">
                {formatRupiah(product.base_price)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
