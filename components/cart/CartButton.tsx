"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X, Trash2, ArrowRight } from "lucide-react";
import { useCart, type CartItem, cartItemKey } from "./cart-context";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function formatMoney(minor?: number) {
  if (!minor || Number.isNaN(minor)) return "£0.00";
  return `£${(minor / 100).toFixed(2)}`;
}

// 🔹 Always compute prices from unit price & qty
function getUnitMinor(item: CartItem): number {
  if (typeof item.unitMinor === "number" && !Number.isNaN(item.unitMinor)) {
    return item.unitMinor;
  }
  if (typeof (item as any).priceMinor === "number") {
    return (item as any).priceMinor;
  }
  if (typeof item.price === "number" && !Number.isNaN(item.price)) {
    return Math.round(item.price * 100);
  }
  if (
    typeof item.totalMinor === "number" &&
    typeof item.qty === "number" &&
    item.qty > 0
  ) {
    return Math.round(item.totalMinor / item.qty);
  }
  return 0;
}

function getQty(item: CartItem): number {
  const q = Number(item.qty ?? 1);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return Math.round(q);
}

// ---------- Cart sheet / drawer UI ----------

function CartSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const portalTarget =
    typeof document !== "undefined" ? document.body : null;
  if (!portalTarget || !open) return null;

  // ✅ subtotal = Σ (unitMinor × qty)
  const subtotalMinor = items.reduce((sum, it) => {
    const unitMinor = getUnitMinor(it);
    const qty = getQty(it);
    const lineMinor =
      unitMinor > 0
        ? unitMinor * qty
        : typeof it.totalMinor === "number"
        ? it.totalMinor
        : 0;
    return sum + lineMinor;
  }, 0);

  const content = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-stretch md:justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close basket"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        className={
          isDesktop
            ? "relative h-full w-full max-w-md border-l border-slate-200 bg-white shadow-2xl"
            : "relative w-full rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5 md:py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Your basket
            </p>
            <p className="text-sm text-slate-700">
              {items.length === 0
                ? "No items added yet"
                : `${items.length} item${
                    items.length > 1 ? "s" : ""
                  } in basket`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-3 md:max-h-[calc(100vh-180px)] md:px-5 md:py-4">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add a treatment or medicine from the booking flow to see it
              here.
            </p>
          ) : (
            items.map((item) => {
              const key = cartItemKey(item);

              const unitMinor = getUnitMinor(item);
              const qty = getQty(item);
              const lineMinor =
                unitMinor > 0
                  ? unitMinor * qty
                  : typeof item.totalMinor === "number"
                  ? item.totalMinor
                  : 0;

              return (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3"
                >
                  {/* Thumbnail */}
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-200/60">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                        Item
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                    {item.variation && (
                      <p className="text-[11px] text-slate-500">
                        {item.variation}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Qty {qty}
                    </p>
                  </div>

                  {/* Price + remove */}
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(lineMinor)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("pe-remove-from-cart", {
                            detail: { key },
                          })
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer summary */}
        <div className="border-t border-slate-200 px-4 py-3 md:px-5 md:py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="text-base font-semibold text-slate-900">
              {formatMoney(subtotalMinor)}
            </span>
          </div>
          <button
            type="button"
            disabled={items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Review &amp; continue
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-2 text-[11px] text-slate-500">
            You&apos;ll confirm your appointment time and complete payment on
            the next step.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
}

// ---------- Button shown in navbar ----------

export default function CartButton() {
  const { items, isOpen, toggleCart, closeCart, removeItem } = useCart();

  // Hydration guard so server & client markup match
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Hook up remove event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (!detail?.key) return;
      removeItem(detail.key);
    };

    window.addEventListener("pe-remove-from-cart", handler);
    return () => window.removeEventListener("pe-remove-from-cart", handler);
  }, [removeItem]);

  // Badge count = total qty
  const count = items.reduce((sum, it) => sum + getQty(it), 0);

  return (
    <>
      <button
        type="button"
        onClick={toggleCart}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-cyan-400 hover:text-cyan-700"
      >
        <ShoppingCart className="h-4 w-4" />
        {hydrated && count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {hydrated && (
        <CartSheet open={isOpen} onClose={closeCart} items={items} />
      )}
    </>
  );
}
