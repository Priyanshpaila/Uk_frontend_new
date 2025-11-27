"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import {
  fetchServiceBySlug,
  fetchServiceMedicinesByServiceId,
  buildMediaUrl,
  type ServiceMedicineDto,
} from "@/lib/api";

// Normalised UI model
type UIMedicine = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  strength?: string;
  variationText?: string;
  variations: string[]; // dropdown options
  price: number; // major units (e.g. 80.0)
  unitMinor: number; // minor units
  image: string;
  minQty: number;
  maxQty?: number; // undefined = unlimited
  stockQty: number;
  outOfStock: boolean;
};

// --------------- Medicine Card UI ---------------

// --------------- Medicine Card UI ---------------

function CatalogProductCard({ item }: { item: UIMedicine }) {
  // grab full cart so we can see existing items
  const cart = useCart() as any;
  const { addItem, openCart } = cart;

  const cartItems: any[] = Array.isArray(cart?.items)
    ? cart.items
    : Array.isArray(cart?.state?.items)
    ? cart.state.items
    : [];

  const [qty, setQty] = useState<number>(item.minQty);

  const hasVariations = item.variations && item.variations.length > 0;
  const [selectedVariation, setSelectedVariation] = useState<string>(
    hasVariations ? item.variations[0] : ""
  );

  const minQty = item.minQty;
  const maxQty = (item.maxQty ?? item.stockQty) || undefined;

  const clamp = (value: number) => {
    let v = Number.isFinite(value) ? value : minQty;
    if (v < minQty) v = minQty;
    if (maxQty != null && maxQty > 0) v = Math.min(v, maxQty);
    return v;
  };

  // how many of THIS sku + variation are already in cart?
  const existingQty = useMemo(() => {
    if (!cartItems.length) return 0;

    const match = cartItems.find((ci: any) => {
      if (!ci) return false;
      const sameSku = ci.sku === item.sku;

      const existingVar = ci.variation || ci.variations || ci.optionLabel || "";
      const currentVar = selectedVariation || "";

      return sameSku && existingVar === currentVar;
    });

    return Number(match?.qty ?? 0);
  }, [cartItems, item.sku, selectedVariation]);

  const onAdd = () => {
    if (item.outOfStock) return;
    if (hasVariations && !selectedVariation) return;

    const desired = clamp(qty); // what user typed on the card
    const already = existingQty;

    // final total must not exceed maxQty / stock
    let allowedMax = maxQty ?? item.stockQty ?? Infinity;
    if (!Number.isFinite(allowedMax) || allowedMax <= 0) {
      allowedMax = item.stockQty || desired;
    }

    const targetTotal = Math.min(allowedMax, already + desired);
    const delta = targetTotal - already; // how many more we’re allowed to add

    if (delta <= 0) {
      // already at or above max – nothing more to add
      return;
    }

    const qtyToAdd = delta;
    const unitMinor = item.unitMinor;
    const totalMinor = unitMinor * qtyToAdd;

    const normalise = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const slug = normalise(item.sku || item.id);

    addItem({
      id: item.id,
      sku: item.sku,
      slug,
      name: item.name,
      image: item.image,
      price: item.price, // major units for UI
      qty: qtyToAdd, // only the extra quantity
      unitMinor,
      totalMinor,
      strength: item.strength,
      maxQty: maxQty ?? null,
      variation: selectedVariation || undefined,
      variations: selectedVariation || undefined,
      optionLabel: selectedVariation || undefined,
      label: selectedVariation || undefined,
    });

    if (typeof openCart === "function") {
      openCart();
    }
  };

  const disabled =
    item.outOfStock ||
    qty < minQty ||
    (maxQty != null && maxQty > 0 && qty > maxQty) ||
    (hasVariations && !selectedVariation);

  return (
    <article className="flex h-full w-full flex-col rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(15,23,42,0.16)] sm:p-6">
      {/* Image */}
      <div className="mb-4 flex w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.name}
          className="max-h-28 w-full max-w-[220px] rounded-2xl object-contain"
        />
      </div>

      {/* Title & basic info */}
      <div className="mb-4 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
            {item.name}
          </h3>
          {item.sku && (
            <span className="mt-0.5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {item.sku}
            </span>
          )}
        </div>

        {(item.strength || item.variationText) && (
          <p className="text-[11px] text-slate-500">
            {[item.strength, item.variationText].filter(Boolean).join(" · ")}
          </p>
        )}

        {item.description && (
          <p className="line-clamp-2 text-xs text-slate-600 sm:text-sm">
            {item.description}
          </p>
        )}
      </div>

      {/* Price row */}
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold text-emerald-600 sm:text-2xl">
            £{item.price.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500">per dose</span>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          {item.outOfStock ? "Out of stock" : `In stock: ${item.stockQty || 0}`}
        </div>
      </div>

      {/* Variation selector */}
      {hasVariations && (
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-medium text-slate-600">
            Select variation
          </label>
          <select
            className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm text-slate-900 shadow-inner focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={selectedVariation}
            onChange={(e) => setSelectedVariation(e.target.value)}
          >
            {item.variations.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quantity + Add */}
      <div className="mt-auto flex items-center gap-3">
        <div className="flex flex-col">
          <label className="mb-1 text-[11px] font-medium text-slate-600">
            Quantity
          </label>
          <input
            type="number"
            min={minQty}
            {...(maxQty != null && maxQty > 0 ? { max: maxQty } : {})}
            value={qty}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              setQty(clamp(parsed));
            }}
            className="w-20 rounded-full border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="mt-1 text-[10px] text-slate-500">
            Min {minQty}
            {maxQty != null && maxQty > 0 ? ` · Max ${maxQty}` : ""}
          </p>
        </div>

        <button
          onClick={onAdd}
          disabled={disabled}
          className={`flex-1 rounded-full py-2.5 text-sm font-semibold shadow-sm transition ${
            disabled
              ? "cursor-not-allowed bg-slate-200 text-slate-500"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          {item.outOfStock ? "Out of stock" : "Add to basket"}
        </button>
      </div>
    </article>
  );
}

// -------------------- Treatments Step --------------------

export default function TreatmentsStep({
  serviceSlug: serviceSlugProp,
  serviceId: serviceIdProp,
}: {
  serviceSlug?: string;
  serviceId?: string;
}) {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const serviceSlug = serviceSlugProp ?? params?.slug;

  // serviceId from prop or query (?serviceId / ?service_id)
  const serviceIdFromQuery =
    searchParams?.get("serviceId") || searchParams?.get("service_id") || "";
  const initialServiceId = (serviceIdProp ?? serviceIdFromQuery) || null;

  const [resolvedServiceId, setResolvedServiceId] = useState<string | null>(
    initialServiceId
  );
  const [resolvingService, setResolvingService] = useState(false);
  const [serviceResolveError, setServiceResolveError] = useState<string | null>(
    null
  );

  // Track auth state (client-only)
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    try {
      const hasToken = !!localStorage.getItem("token");
      const hasCookie =
        typeof document !== "undefined" &&
        document.cookie.includes("logged_in=1");
      setIsLoggedIn(hasToken || hasCookie);
    } catch {
      setIsLoggedIn(false);
    }
  }, []);

  // Tell the booking flow where to go when user continues (stored only)
  useEffect(() => {
    if (!serviceSlug) return;
    const q = new URLSearchParams(searchParams?.toString() ?? "");
    q.set("step", isLoggedIn ? "raf" : "login");
    const bookingNext = `/private-services/${serviceSlug}/book?${q.toString()}`;

    try {
      sessionStorage.setItem("booking_next", bookingNext);
      sessionStorage.setItem("booking_slug", String(serviceSlug));
    } catch {}
  }, [serviceSlug, isLoggedIn, searchParams]);

  const [data, setData] = useState<ServiceMedicineDto[] | null>(null);
  const [loadingMedicines, setLoadingMedicines] = useState(true);
  const [medicineError, setMedicineError] = useState<string | null>(null);

  // -------- 1) Resolve serviceId via API (slug → _id) --------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (initialServiceId) {
        setResolvedServiceId(initialServiceId);
        setServiceResolveError(null);
        return;
      }

      if (!serviceSlug) return;

      setResolvingService(true);
      setServiceResolveError(null);

      try {
        const svc = await fetchServiceBySlug(serviceSlug);
        if (cancelled) return;

        if (svc?._id) {
          setResolvedServiceId(svc._id);
          setServiceResolveError(null);
        } else {
          setResolvedServiceId(null);
          setServiceResolveError(`No service found for slug "${serviceSlug}".`);
        }
      } catch (err: any) {
        if (cancelled) return;
        setResolvedServiceId(null);
        setServiceResolveError(
          err?.message || "Failed to resolve service ID from slug."
        );
      } finally {
        if (!cancelled) setResolvingService(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [initialServiceId, serviceSlug]);

  // -------- 2) Fetch medicines for resolved service --------
  useEffect(() => {
    if (!resolvedServiceId) {
      setData(null);
      setLoadingMedicines(false);
      return;
    }

    let mounted = true;
    setLoadingMedicines(true);
    setMedicineError(null);

    fetchServiceMedicinesByServiceId(resolvedServiceId)
      .then((json) => {
        if (!mounted) return;
        setData(json);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setMedicineError(
          `Failed to load medicines: ${String(err?.message || err)}`
        );
        if (typeof window !== "undefined") {
          console.warn("TreatmentsStep medicines fetch failed:", err);
        }
      })
      .finally(() => mounted && setLoadingMedicines(false));

    return () => {
      mounted = false;
    };
  }, [resolvedServiceId]);

  // -------- 3) Map API → UI model --------
  const uiMedicines: UIMedicine[] = useMemo(() => {
    if (!data?.length) return [];

    return data.map((m) => {
      const unitMinor =
        typeof m.unitMinor === "number" && m.unitMinor > 0
          ? m.unitMinor
          : Math.round((m.price ?? 0) * 100);
      const price = unitMinor / 100;

      const stockQty = typeof m.qty === "number" ? m.qty : 0;
      const minQty = (m as any).min ?? (m as any).min_qty ?? 1;

      const maxCandidate = (m as any).max ?? (m as any).max_qty ?? stockQty;
      const maxQty =
        typeof maxCandidate === "number" && maxCandidate > 0
          ? maxCandidate
          : undefined;

      const outOfStock =
        (m.status && m.status !== "active") ||
        stockQty <= 0 ||
        (maxQty !== undefined && maxQty <= 0);

      const imageUrl = buildMediaUrl(m.image);

      // normalise variations
      let variationOptions: string[] = [];
      if (Array.isArray(m.variations)) {
        variationOptions = m.variations
          .map((v) => (v ?? "").toString().trim())
          .filter(Boolean);
      } else if (typeof m.variations === "string" && m.variations.trim()) {
        variationOptions = m.variations
          .split(/[|,;/]+/)
          .map((v) => v.trim())
          .filter(Boolean);
      } else if (typeof m.variation === "string" && m.variation.trim()) {
        variationOptions = [m.variation.trim()];
      }

      let variationText: string | undefined;
      if (Array.isArray(m.variations)) {
        variationText = m.variations
          .map((v) => (v ?? "").toString().trim())
          .filter(Boolean)
          .join(", ");
        if (!variationText) variationText = undefined;
      } else if (typeof m.variations === "string" && m.variations.trim()) {
        variationText = m.variations.trim();
      } else if (typeof m.variation === "string" && m.variation.trim()) {
        variationText = m.variation.trim();
      }

      return {
        id: m._id,
        sku: m.sku,
        name: m.name,
        description: m.description,
        strength: m.strength,
        variationText,
        variations: variationOptions,
        price,
        unitMinor,
        image: imageUrl,
        minQty: minQty > 0 ? minQty : 1,
        maxQty,
        stockQty,
        outOfStock,
      };
    });
  }, [data]);

  const showLoading =
    resolvingService || (loadingMedicines && !!resolvedServiceId);

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-4 pb-10 sm:px-6 lg:px-8">
      <header className="space-y-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Booking journey
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
          Select your medicines
        </h2>
        <p className="text-sm text-slate-500">
          Choose the medicines you need for this service and add them to your
          basket.
        </p>
      </header>

      {showLoading && (
        <div className="text-center text-sm text-slate-600">
          Loading medicines…
        </div>
      )}

      {!showLoading && serviceResolveError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          {serviceResolveError}
        </div>
      )}

      {!showLoading && !serviceResolveError && !resolvedServiceId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
          No service ID resolved. Make sure a valid service exists for this
          page.
        </div>
      )}

      {medicineError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
          {medicineError}
        </div>
      )}

      {!showLoading &&
        !medicineError &&
        resolvedServiceId &&
        uiMedicines.length === 0 && (
          <div className="text-center text-sm text-slate-500">
            No medicines are configured for this service yet.
          </div>
        )}

      <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
        {uiMedicines.map((m) => (
          <CatalogProductCard key={m.id} item={m} />
        ))}
      </div>
    </section>
  );
}
