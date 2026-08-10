import type { Metadata } from "next";
import type { IconType } from "react-icons";
import { SiInstagram, SiShopee, SiTiktok, SiWhatsapp } from "react-icons/si";
import { buildWhatsAppUrl, getSiteContent } from "@/lib/api";

export const metadata: Metadata = {
  title: "Velcro Ethereal — Kontak",
  description:
    "Hubungi Velcro Ethereal — WhatsApp, email, dan kanal resmi lainnya.",
};

/**
 * /kontak — Server Component. Seluruh isinya dikelola lewat panel admin
 * (site_contents section "contact"), jadi tidak ada kontak yang hardcode di
 * sini. Field yang belum diisi admin (alamat/email/telepon bisa null) otomatis
 * tidak dirender, bukan tampil sebagai baris kosong.
 *
 * Ikon social dipetakan manual per `platform` karena komponen React tidak bisa
 * disimpan di database; platform di luar peta ini tetap dirender, hanya tanpa
 * ikon (lihat SOCIAL_ICONS).
 */
const SOCIAL_ICONS: Record<string, IconType> = {
  instagram: SiInstagram,
  whatsapp: SiWhatsapp,
  shopee: SiShopee,
  tiktok: SiTiktok,
};

const labelClass =
  "font-jost text-xs font-medium uppercase tracking-[0.3em] text-gold";

export default async function KontakPage() {
  const { contact } = await getSiteContent();

  const whatsappUrl = buildWhatsAppUrl(
    contact.whatsapp_number,
    contact.whatsapp_message,
  );

  const socialLinks = contact.social_links.filter((link) => link.url);

  return (
    <main className="flex-1 bg-ink px-6 py-28 text-cream sm:py-36">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className={`mb-6 ${labelClass}`}>Kontak</p>
          <h1 className="font-serif text-5xl font-light italic leading-tight sm:text-7xl">
            Mari berbincang.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-cream/70">
            Pertanyaan seputar koleksi, pemesanan khusus, atau kolaborasi — kami
            senang mendengarnya.
          </p>
        </header>

        <div className="mt-16 grid gap-12 border-t border-cream/10 pt-12 sm:grid-cols-2 lg:gap-16">
          {/* Kolom kiri — detail kontak */}
          <div className="flex flex-col gap-10">
            {contact.address && (
              <section>
                <h2 className={labelClass}>Alamat</h2>
                <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-cream/70">
                  {contact.address}
                </p>
                {contact.maps_url && (
                  <a
                    href={contact.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex w-fit items-center gap-2 text-sm text-cream/70 transition-colors hover:text-gold"
                  >
                    Lihat di Google Maps
                    <span aria-hidden="true">→</span>
                  </a>
                )}
              </section>
            )}

            {contact.email && (
              <section>
                <h2 className={labelClass}>Email</h2>
                <a
                  href={`mailto:${contact.email}`}
                  className="mt-4 inline-block text-base leading-relaxed text-cream/70 transition-colors hover:text-gold"
                >
                  {contact.email}
                </a>
              </section>
            )}

            {contact.phone && (
              <section>
                <h2 className={labelClass}>Telepon</h2>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, "")}`}
                  className="mt-4 inline-block text-base leading-relaxed text-cream/70 transition-colors hover:text-gold"
                >
                  {contact.phone}
                </a>
              </section>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-3 rounded-full border border-gold px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] text-cream transition-colors duration-300 hover:bg-gold hover:text-ink"
              >
                <SiWhatsapp className="text-lg" aria-hidden="true" />
                Chat via WhatsApp
              </a>
            )}
          </div>

          {/* Kolom kanan — kanal resmi */}
          {socialLinks.length > 0 && (
            <div>
              <h2 className={labelClass}>Kanal Resmi</h2>
              <ul className="mt-6 flex flex-col gap-3">
                {socialLinks.map((link, index) => {
                  const Icon = link.platform
                    ? SOCIAL_ICONS[link.platform]
                    : undefined;

                  return (
                    <li key={index}>
                      <a
                        href={link.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-sm border border-cream/10 bg-ink-soft px-5 py-4 text-sm text-cream/80 transition-colors duration-300 hover:border-gold/40 hover:text-gold"
                      >
                        {Icon && (
                          <Icon
                            className="text-lg text-gold transition-colors duration-300"
                            aria-hidden="true"
                          />
                        )}
                        <span>{link.label ?? link.url}</span>
                        <span
                          aria-hidden="true"
                          className="ml-auto transition-transform duration-300 group-hover:translate-x-1"
                        >
                          →
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
