"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  id?: string;
  sku?: string;
  name: string;
  qty: number;
  price?: number; // in pounds
  unitMinor?: number; // in minor units (pence)
  totalMinor?: number; // in minor units (pence)
  image?: string | null;
  variation?: string | null;
  [key: string]: any;
};

type CartState = {
  items: CartItem[];
};

type CartContextValue = {
  state: CartState;
  items: CartItem[];

  addItem: (item: CartItem) => void;
  updateItemQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;

  // UI state for sheet / drawer
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

// Key used in localStorage
const STORAGE_KEY = "pe_cart_v1";

/**
 * 🔑 Single source of truth for how we identify a cart line.
 * Same medicine + different variation => different key.
 */
export function cartItemKey(item: CartItem): string {
  const base = item.id || item.sku || item.name || "item";
  const variation =
    item.variation ||
    (item as any).label ||
    (item as any).optionLabel ||
    (item as any).strength ||
    "";
  return `${base}::${variation}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(() => {
    if (typeof window === "undefined") return { items: [] };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { items: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
      return { items: parsed.items };
    } catch {
      return { items: [] };
    }
  });

  const [isOpen, setIsOpen] = useState(false);

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  const addItem = (item: CartItem) => {
    setState((prev) => {
      const items = [...prev.items];

      const key = cartItemKey(item);
      const existingIndex = items.findIndex(
        (it) => cartItemKey(it) === key
      );

      if (existingIndex >= 0) {
        const existing = items[existingIndex];
        const nextQty = (existing.qty || 0) + (item.qty || 1);
        items[existingIndex] = { ...existing, qty: nextQty };
      } else {
        items.push({ ...item, qty: item.qty || 1 });
      }

      return { items };
    });

    // open cart on first add for better UX
    setIsOpen(true);
  };

  const updateItemQty = (key: string, qty: number) => {
    setState((prev) => {
      const items = prev.items
        .map((it) =>
          cartItemKey(it) === key
            ? { ...it, qty: Math.max(1, qty) }
            : it
        )
        .filter((it) => it.qty > 0);
      return { items };
    });
  };

  const removeItem = (key: string) => {
    setState((prev) => ({
      items: prev.items.filter((it) => cartItemKey(it) !== key),
    }));
  };

  const clearCart = () => setState({ items: [] });

  const value: CartContextValue = useMemo(
    () => ({
      state,
      items: state.items,
      addItem,
      updateItemQty,
      removeItem,
      clearCart,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen((v) => !v),
    }),
    [state, isOpen]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
