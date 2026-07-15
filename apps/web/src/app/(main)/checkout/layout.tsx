import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Velcro Ethereal — Checkout",
};

/**
 * checkout/page.tsx adalah Client Component ("use client", pakai useCart
 * hook) — metadata/generateMetadata cuma didukung di Server Component, jadi
 * title ditaruh di layout.tsx sibling ini (Server Component) alih-alih di
 * page.tsx. Child routes (payment/, success/) override title ini lewat
 * layout.tsx masing-masing.
 */
export default function CheckoutLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
