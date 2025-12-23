"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ShoppingCart,
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  RotateCcw,
} from "lucide-react";
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
  if (minor == null || Number.isNaN(minor)) return "£0.00";
  return `£${(minor / 100).toFixed(2)}`;
}

// ✅ Always compute prices from unit price & qty
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

function getMinQty(item: CartItem): number {
  const min = Number((item as any).minQty ?? (item as any).min_qty ?? 1);
  return Number.isFinite(min) && min > 0 ? Math.round(min) : 1;
}

function getMaxQty(item: CartItem): number | null {
  const raw =
    (item as any).maxQty ??
    (item as any).max_qty ??
    (item as any).max_bookable_quantity ??
    null;

  const max = Number(raw);
  if (!Number.isFinite(max) || max <= 0) return null;
  return Math.round(max);
}

function clampQty(next: number, min: number, max: number | null) {
  let v = Number.isFinite(next) ? Math.round(next) : min;
  if (v < min) v = min;
  if (max != null && v > max) v = max;
  return v;
}

/* ------------------------------------------------------------------ */
/*                         Cart sheet / drawer                         */
/* ------------------------------------------------------------------ */

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
  const cart = useCart() as any;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ Capabilities (hook-safe)
  const canUpdateQty = typeof cart?.updateItemQty === "function";
  const canRemove = typeof cart?.removeItem === "function";
  const canClear = typeof cart?.clearCart === "function";
  const canAdd = typeof cart?.addItem === "function";

  // ✅ Count = total qty (hook-safe)
  const totalCount = useMemo(
    () => items.reduce((sum, it) => sum + getQty(it), 0),
    [items]
  );

  // ✅ subtotal = Σ (unitMinor × qty) (hook-safe)
  const subtotalMinor = useMemo(() => {
    return items.reduce((sum, it) => {
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
  }, [items]);

  // Clear confirm (hook-safe)
  const [confirmClear, setConfirmClear] = useState(false);

  // Undo (hook-safe)
  const [undo, setUndo] = useState<{ label: string; items: CartItem[] } | null>(
    null
  );
  const undoTimer = useRef<number | null>(null);

  const showUndo = (label: string, removedItems: CartItem[]) => {
    setUndo({ label, items: removedItems });
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 4500);
  };

  useEffect(() => {
    return () => {
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    };
  }, []);

  // ESC closes (hook-safe)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleRemoveLine = (item: CartItem) => {
    if (!canRemove) return;
    const key = cartItemKey(item);
    showUndo(`Removed “${item.name}”`, [{ ...item }]);
    cart.removeItem(key);
  };

  const handleClear = () => {
    if (!canClear) return;
    if (!items.length) return;

    const snapshot = items.map((x) => ({ ...x }));
    showUndo("Cleared basket", snapshot);
    cart.clearCart();
    setConfirmClear(false);
  };

  const handleUndo = () => {
    if (!undo?.items?.length || !canAdd) return;

    for (const it of undo.items) {
      try {
        // if your addItem supports options, this prevents auto-open logic
        cart.addItem(it, { openCart: false });
      } catch {
        cart.addItem(it);
      }
    }
    setUndo(null);
  };

  const handleQtyChange = (item: CartItem, delta: number) => {
    if (!canUpdateQty) return;

    const key = cartItemKey(item);
    const current = getQty(item);
    const min = getMinQty(item);
    const max = getMaxQty(item);

    // ✅ Minus at min => remove only THIS line
    if (delta < 0 && current <= min) {
      handleRemoveLine(item);
      return;
    }

    const next = clampQty(current + delta, min, max);
    cart.updateItemQty(key, next);
  };

  const handleQtyInput = (item: CartItem, raw: string) => {
    if (!canUpdateQty) return;

    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;

    const key = cartItemKey(item);
    const min = getMinQty(item);
    const max = getMaxQty(item);

    const next = clampQty(parsed, min, max);
    cart.updateItemQty(key, next);
  };

  // ✅ ONLY AFTER all hooks:
  if (!mounted) return null;

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget || !open) return null;

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
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
              <ShoppingBag className="h-4 w-4 text-emerald-600" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Your basket
              </p>
              <p className="text-sm text-slate-700">
                {totalCount === 0
                  ? "No items added yet"
                  : `${totalCount} item${totalCount > 1 ? "s" : ""} in basket`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canClear && items.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 md:inline-flex"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Clear confirmation */}
        {confirmClear && (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 md:px-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-700">
                Clear all items from your basket?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-3 md:max-h-[calc(100vh-210px)] md:px-5 md:py-4">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              Add a treatment or medicine from the booking flow to see it here.
            </p>
          ) : (
            items.map((item) => {
              const key = cartItemKey(item);
              const unitMinor = getUnitMinor(item);
              const qty = getQty(item);
              const lineMinor = unitMinor * qty;

              const min = getMinQty(item);
              const max = getMaxQty(item);
              const minusShowsRemove = qty <= min;

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

                    {(min > 1 || max != null) && (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {min > 1 ? `Min ${min}` : ""}
                        {max != null ? `${min > 1 ? " · " : ""}Max ${max}` : ""}
                      </p>
                    )}

                    {/* Qty controls */}
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item, -1)}
                        disabled={!canUpdateQty}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={minusShowsRemove ? "Remove item" : "Decrease"}
                      >
                        <Minus className="h-3 w-3" />
                      </button>

                      <input
                        inputMode="numeric"
                        value={String(qty)}
                        onChange={(e) => handleQtyInput(item, e.target.value)}
                        disabled={!canUpdateQty}
                        className="h-6 w-10 rounded-full border border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-800 focus:border-emerald-400 focus:outline-none disabled:opacity-60"
                      />

                      <button
                        type="button"
                        onClick={() => handleQtyChange(item, +1)}
                        disabled={!canUpdateQty || (max != null && qty >= max)}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          max != null && qty >= max ? "Max reached" : "Increase"
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </button>

                      <span className="ml-1 text-[11px] text-slate-500">
                        {minusShowsRemove ? "Min → remove" : "Qty"}
                      </span>
                    </div>

                    {max != null && qty >= max && (
                      <p className="mt-2 text-[10px] font-medium text-amber-700">
                        Maximum quantity reached for this item.
                      </p>
                    )}
                  </div>

                  {/* Price + remove */}
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatMoney(lineMinor)}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {formatMoney(unitMinor)} each
                    </p>

                    <button
                      type="button"
                      onClick={() => handleRemoveLine(item)}
                      disabled={!canRemove}
                      className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
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

          {undo && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <p className="text-xs font-medium text-slate-700">{undo.label}</p>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canAdd}
                className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
}

/* ------------------------------------------------------------------ */
/*                         Navbar Cart Button                          */
/* ------------------------------------------------------------------ */

export default function CartButton() {
  const { items, isOpen, toggleCart, closeCart } = useCart();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const count = useMemo(
    () => items.reduce((sum, it) => sum + getQty(it), 0),
    [items]
  );

  return (
    <>
      <button
        type="button"
        onClick={toggleCart}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-cyan-400 hover:text-cyan-700"
        aria-label="Open basket"
      >
        <ShoppingCart className="h-4 w-4" />
        {hydrated && count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {hydrated && <CartSheet open={isOpen} onClose={closeCart} items={items} />}
    </>
  );
}
