"use client";

/**
 * SIMULASI — cart state 100% frontend, in-memory (React Context).
 * Dibangun untuk keperluan demo/pitching ke client (Milestone 6, Bagian C).
 * TIDAK terhubung ke backend/API order apa pun dan TIDAK di-persist ke mana pun.
 *
 * KETERBATASAN yang DISENGAJA (bukan bug): isi cart hilang saat halaman di-refresh
 * atau tab ditutup, karena state hanya hidup di memori React. Persistensi
 * (localStorage/DB) sengaja tidak dibuat — di luar cakupan simulasi ini.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  size: string;
  /** SKU varian — identitas unik item cart (produk + ukuran). */
  sku: string;
  /** Harga string decimal dari API (mis. "850000.00"). */
  basePrice: string;
  /** URL foto utama, atau null kalau produk belum punya foto. */
  image: string | null;
  qty: number;
}

interface CartContextValue {
  items: CartItem[];
  /** Total kuantitas seluruh item (untuk badge header). */
  count: number;
  /** Subtotal dalam number (basePrice × qty dijumlahkan). */
  subtotal: number;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  updateQty: (sku: string, qty: number) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (item: Omit<CartItem, "qty">, qty: number = 1) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.sku === item.sku);
        if (existing) {
          // Item ukuran sama sudah ada → tambah qty-nya.
          return prev.map((i) =>
            i.sku === item.sku ? { ...i, qty: i.qty + qty } : i,
          );
        }
        return [...prev, { ...item, qty }];
      });
    },
    [],
  );

  const updateQty = useCallback((sku: string, qty: number) => {
    setItems((prev) =>
      // qty minimal 1; hapus item lewat removeItem, bukan qty 0.
      prev.map((i) => (i.sku === sku ? { ...i, qty: Math.max(1, qty) } : i)),
    );
  }, []);

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.qty, 0),
    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, i) => sum + Number.parseFloat(i.basePrice) * i.qty,
        0,
      ),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      count,
      subtotal,
      addItem,
      updateQty,
      removeItem,
      clearCart,
    }),
    [items, count, subtotal, addItem, updateQty, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Akses cart context. Harus dipanggil di dalam <CartProvider>. */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart harus dipakai di dalam <CartProvider>.");
  }
  return ctx;
}
