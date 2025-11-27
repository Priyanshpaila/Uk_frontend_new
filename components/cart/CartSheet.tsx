"use client";

import { useEffect } from "react";
import {
  X,
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useCart } from "./cart-context";


// Helper to read items in a tolerant way (cart.items OR cart.state.items)
function useCartItems() {
  const cart = useCart() as any;
  const items: any[] = Array.isArray(cart?.items)
    ? cart.items
    : Array.isArray(cart?.state?.items)
    ? cart.state.items
    : [];

  return { cart, items };
}

function getItemId(item: any): string {
  return (
    item.id ||
    item._id ||
    item.sku ||
    item.slug ||
    item.name ||
    Math.random().toString(36)
  );
}

function getItemQty(item: any): number {
  return Number(
    item.qty ??
      item.quantity ??
      item.count ??
      1
  );
}

function getMinorPrice(item: any): number {
  if (typeof item.totalMinor === "number") return item.totalMinor;
  if (typeof item.unitMinor === "number")
    return item.unitMinor * getItemQty(item);
  if (typeof item.priceMinor === "number")
    return item.priceMinor * getItemQty(item);
  if (typeof item.price === "number")
    return Math.round(item.price * 100) * getItemQty(item);
  return 0;
}

function formatMoneyFromMinor(minor?: number) {
  if (minor == null || Number.isNaN(minor)) return "£0.00";
  return `£${(minor / 100).toFixed(2)}`;
}

type CartSheetProps = {
  open: boolean;
  onClose: () => void;
};

export default function CartSheet({ open, onClose }: CartSheetProps) {
  const { cart, items } = useCartItems();

  const totalMinor = items.reduce(
    (sum, it) => sum + getMinorPrice(it),
    0
  );
  const totalCount = items.reduce(
    (sum, it) => sum + getItemQty(it),
    0
  );

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const canUpdateQty =
    typeof (cart as any)?.updateItemQty === "function" ||
    typeof (cart as any)?.setItemQty === "function";

  const canRemove =
    typeof (cart as any)?.removeItem === "function" ||
    typeof (cart as any)?.remove === "function";

  const canClear = typeof (cart as any)?.clear === "function";

  const handleQtyChange = (item: any, delta: number) => {
    if (!canUpdateQty) return;
    const id = getItemId(item);
    const current = getItemQty(item);
    const next = Math.max(1, current + delta);

    const updater =
      (cart as any).updateItemQty || (cart as any).setItemQty;
    updater(id, next);
  };

  const handleRemove = (item: any) => {
    if (!canRemove) return;
    const id = getItemId(item);
    const remover =
      (cart as any).removeItem || (cart as any).remove;
    remover(id);
  };

  const handleClear = () => {
    if (!canClear) return;
    (cart as any).clear();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel: bottom sheet on mobile, right drawer on md+ */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center md:inset-y-0 md:right-0 md:left-auto">
        <div className="flex w-full max-w-md flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl md:h-full md:max-w-sm md:rounded-none md:rounded-l-3xl md:border-l md:p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Your basket
                </p>
                <p className="text-[11px] text-slate-500">
                  {totalCount === 0
                    ? "No items added yet"
                    : `${totalCount} item${totalCount > 1 ? "s" : ""} in basket`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 md:px-5">
            {items.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-slate-500">
                <p className="mb-1 text-sm font-medium text-slate-700">
                  Your basket is empty
                </p>
                <p>
                  Add a treatment or medicine to your basket to see it here.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {items.map((item: any) => {
                  const id = getItemId(item);
                  const qty = getItemQty(item);
                  const lineMinor = getMinorPrice(item);
                  const unitMinor =
                    lineMinor && qty > 0
                      ? Math.round(lineMinor / qty)
                      : undefined;

                  return (
                    <li
                      key={id}
                      className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
                    >
                      {/* Thumbnail / initials */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                        {(item.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.name || "Product"}
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        )) ||
                          (item.name?.[0] || "P")}
                      </div>

                      {/* Details */}
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-900">
                              {item.name || item.title || "Treatment"}
                            </p>
                            {(item.variation ||
                              item.strength) && (
                              <p className="text-[11px] text-slate-500">
                                {item.variation || item.strength}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-900">
                              {formatMoneyFromMinor(lineMinor)}
                            </p>
                            {unitMinor != null && (
                              <p className="text-[11px] text-slate-500">
                                {formatMoneyFromMinor(unitMinor)} each
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-3">
                          {/* Qty controls */}
                          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(item, -1)
                              }
                              disabled={!canUpdateQty || qty <= 1}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-xs font-medium text-slate-800">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleQtyChange(item, +1)
                              }
                              disabled={!canUpdateQty}
                              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            disabled={!canRemove}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer / Total */}
          <div className="border-t border-slate-200 px-4 py-3 md:px-5">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-sm font-semibold text-slate-900">
                {formatMoneyFromMinor(totalMinor)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              {canClear && items.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[11px] font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
                >
                  Clear basket
                </button>
              )}
              <button
                type="button"
                disabled={items.length === 0}
                onClick={onClose /* TODO: replace with real checkout nav */}
                className="ml-auto inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-soft-card hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Review &amp; continue
              </button>
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
              You’ll confirm your appointment time and complete payment
              on the next step.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
