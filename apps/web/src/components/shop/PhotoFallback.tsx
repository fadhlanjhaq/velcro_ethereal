/**
 * Fallback jujur untuk produk yang BELUM punya foto asli (product_images kosong
 * di API). Bukan broken-image / bukan placeholder yang menyamar sebagai foto —
 * sebuah panel bertekstur warna brand dengan label eksplisit "Foto segera hadir".
 *
 * Pure presentational (tanpa hook) → aman dipakai di Server maupun Client
 * Component. Mengisi penuh parent yang `relative` (absolute inset-0).
 */
export default function PhotoFallback({
  label = "Foto segera hadir",
}: {
  label?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-ink-soft via-ink to-ink-soft">
      {/* Tekstur halus garis diagonal beraksen emas — memberi "isi" tanpa
          berpura-pura menjadi foto produk. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--color-gold) 0, var(--color-gold) 1px, transparent 1px, transparent 11px)",
        }}
      />
      <span aria-hidden="true" className="relative text-2xl text-gold/50">
        ✦
      </span>
      <span className="relative px-4 text-center text-[0.65rem] font-medium uppercase tracking-[0.3em] text-gold/70">
        {label}
      </span>
    </div>
  );
}
