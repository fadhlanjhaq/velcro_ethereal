import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Velcro Ethereal — Payment",
};

/**
 * payment/page.tsx adalah Client Component ("use client", pakai useCart
 * hook) — metadata/generateMetadata cuma didukung di Server Component, jadi
 * title ditaruh di layout.tsx sibling ini (Server Component) alih-alih di
 * page.tsx. Override title dari checkout/layout.tsx parent.
 */
export default function CheckoutPaymentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
