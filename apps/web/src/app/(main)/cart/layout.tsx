import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Velcro Ethereal — Cart",
};

/**
 * cart/page.tsx adalah Client Component ("use client", pakai useCart hook) —
 * metadata/generateMetadata cuma didukung di Server Component, jadi title
 * ditaruh di layout.tsx sibling ini (Server Component) alih-alih di page.tsx.
 */
export default function CartLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
