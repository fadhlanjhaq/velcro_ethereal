/**
 * SIMULASI — nomor order dummy untuk demo (Milestone 6, Bagian C).
 * Timestamp + angka acak. BUKAN dari database; tidak ada order yang tersimpan.
 */
export function generateOrderNumber(): string {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VE-${ts}-${rand}`;
}
