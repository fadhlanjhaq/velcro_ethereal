import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
import PhotoFallback from "@/components/shop/PhotoFallback";
import ProductPurchasePanel from "@/components/shop/ProductPurchasePanel";

export async function generateMetadata(
  props: PageProps<"/shop/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Produk tidak ditemukan — Velcro Ethereal" };
  }

  return {
    title: `${product.name} — Velcro Ethereal`,
    description: product.description,
  };
}

/**
 * /shop/[slug] — Server Component. Fetch produk asli via lib/api.ts; 404
 * (notFound) kalau slug tidak ada. Menampilkan galeri foto (atau PhotoFallback
 * jujur bila belum ada foto), story, deskripsi, harga, dan pilihan ukuran.
 * Interaksi (pilih ukuran + tombol keranjang disabled) diisolasi di client
 * island ProductPurchasePanel.
 */
export default async function ProductDetailPage(
  props: PageProps<"/shop/[slug]">,
) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <main className="flex-1 bg-ink px-6 py-28 text-cream sm:py-36">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/shop"
          className="group inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-cream/60 transition-colors hover:text-gold"
        >
          <span className="transition-transform duration-300 group-hover:-translate-x-1">
            ←
          </span>
          Kembali ke Koleksi
        </Link>

        <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Galeri */}
          <div className="flex flex-col gap-6">
            {product.images.length > 0 ? (
              product.images.map((image, index) => (
                <div
                  key={image.url}
                  className="relative aspect-[3/4] w-full overflow-hidden rounded-sm bg-ink-soft"
                >
                  <Image
                    src={image.url}
                    alt={`${product.name} — foto ${index + 1}`}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ))
            ) : (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-sm bg-ink-soft">
                <PhotoFallback />
              </div>
            )}
          </div>

          {/* Info + pembelian */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-medium uppercase tracking-[0.4em] text-gold">
              {product.category.name}
            </p>
            <h1 className="mt-5 font-serif text-4xl font-light leading-tight sm:text-6xl">
              {product.name}
            </h1>
            <p className="mt-4 text-lg italic leading-relaxed text-cream/70">
              {product.story}
            </p>
            <p className="mt-8 max-w-prose text-base leading-relaxed text-cream/80">
              {product.description}
            </p>

            <div className="mt-10 border-t border-cream/10 pt-10">
              <ProductPurchasePanel product={product} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
