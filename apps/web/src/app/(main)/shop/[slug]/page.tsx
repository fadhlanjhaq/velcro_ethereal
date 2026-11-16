import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
import PhotoFallback from "@/components/shop/PhotoFallback";
import ProductGallery from "@/components/shop/ProductGallery";
import ProductPurchasePanel from "@/components/shop/ProductPurchasePanel";

export async function generateMetadata(
  props: PageProps<"/shop/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product Not Found — Velcro Ethereal" };
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
          {/* Galeri — sticky di lg (lebarnya dibatasi tinggi viewport di
              ProductGallery supaya foto + thumbnail selalu muat). */}
          <div className="lg:sticky lg:top-[calc(var(--site-header-h,96px)_+_24px)] lg:self-start">
            {product.images.length > 0 ? (
              <ProductGallery
                images={product.images}
                productName={product.name}
              />
            ) : (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-sm bg-ink-soft">
                <PhotoFallback />
              </div>
            )}
          </div>

          {/* Info + pembelian */}
          <div>
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
