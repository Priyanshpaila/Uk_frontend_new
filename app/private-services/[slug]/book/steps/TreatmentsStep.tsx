"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart-context";

// ---------------- Types that mirror the API ----------------
type ApiMedicine = {
  _id: string;
  sku: string;
  name: string;
  variations?: string | string[]; // can be single string or array
  strength?: string;
  qty: number; // stock
  unitMinor?: number; // price in minor units (e.g. pence)
  totalMinor?: number;
  variation?: string;
  price?: number; // major units (e.g. 80 -> £80.00)
  image?: string;
  description?: string;
  status?: string | null;

  // 🔮 Future fields (min / max per order). We'll support both name styles.
  min?: number;
  max?: number;
  min_qty?: number;
  max_qty?: number;
};

type ApiService = {
  _id: string;
  slug: string;
  name: string;
  // ...other fields we don't care about here
};

// Normalised UI model
type UIMedicine = {
  id: string;
  sku: string;
  name: string;
  description?: string;
  strength?: string;
  variationText?: string;
  variations: string[]; // 🔽 dropdown options
  price: number; // major units (e.g. 80.0)
  unitMinor: number; // minor units
  image: string;
  minQty: number;
  maxQty?: number; // undefined = unlimited (up to stock)
  stockQty: number;
  outOfStock: boolean;
};

// ---------------- Small helper: API base + origin ----------------
const getApiBase = () => {
  // You can set NEXT_PUBLIC_API_BASE_URL to "http://localhost:8000/api"
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
  const trimmed = raw.replace(/\/+$/, "");
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
};

const getApiOrigin = () => {
  const apiBase = getApiBase();
  return apiBase.replace(/\/api\/?$/, ""); // remove trailing /api
};

// --------------- Medicine Card UI ---------------

function CatalogProductCard({
  item,
  onAdded,
}: {
  item: UIMedicine;
  onAdded?: () => void;
}) {
  const { addItem } = useCart();
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

  const onAdd = () => {
    if (item.outOfStock) return;
    if (hasVariations && !selectedVariation) return;

    const finalQty = clamp(qty);
    const unitMinor = item.unitMinor;
    const totalMinor = unitMinor * finalQty;

    const normalise = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const slug = normalise(item.sku || item.id);

    addItem({
      sku: item.sku,
      slug,
      name: item.name,
      image: item.image,
      price: item.price, // for display in UI
      qty: finalQty,
      unitMinor,
      priceMinor: unitMinor,
      totalMinor,
      maxQty: maxQty ?? null,
      // 🧩 carry variation info into the cart
      variations: selectedVariation || undefined,
      optionLabel: selectedVariation || undefined,
      label: selectedVariation || undefined,
    });

    onAdded?.();
  };

  const disabled =
    item.outOfStock ||
    qty < minQty ||
    (maxQty != null && maxQty > 0 && qty > maxQty) ||
    (hasVariations && !selectedVariation);

  return (
    <div className="flex flex-col h-full w-full rounded-3xl border border-neutral-200 bg-white shadow-sm hover:shadow-xl transition p-5 sm:p-6">
      {/* Image */}
      <div className="w-full flex items-center justify-center mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.name}
          className="max-h-28 sm:max-h-32 object-contain"
        />
      </div>

      {/* Title & basic info */}
      <div className="space-y-1 mb-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg sm:text-xl font-semibold text-neutral-900">
            {item.name}
          </h3>
          {item.sku && (
            <span className="inline-flex items-center rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 bg-neutral-50">
              {item.sku}
            </span>
          )}
        </div>

        {(item.strength || item.variationText) && (
          <p className="text-xs text-neutral-500">
            {[item.strength, item.variationText].filter(Boolean).join(" · ")}
          </p>
        )}

        {item.description && (
          <p className="text-xs sm:text-sm text-neutral-600 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      {/* Price row */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-lg sm:text-xl font-semibold text-emerald-600">
            £{item.price.toFixed(2)}
          </span>
          <span className="text-[11px] text-neutral-500">per dose</span>
        </div>

        <div className="text-[11px] text-neutral-500 text-right">
          {item.outOfStock
            ? "Out of stock"
            : `In stock: ${item.stockQty || 0}`}
        </div>
      </div>

      {/* Variation selector */}
      {hasVariations && (
        <div className="mb-3">
          <label className="block text-[11px] text-neutral-500 mb-1">
            Select variation
          </label>
          <select
            className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
          <label className="text-[11px] text-neutral-500 mb-1">
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
            className="w-20 border border-neutral-300 rounded-full px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p className="mt-1 text-[10px] text-neutral-500">
            Min {minQty}
            {maxQty != null && maxQty > 0 ? ` · Max ${maxQty}` : ""}
          </p>
        </div>

        <button
          onClick={onAdd}
          disabled={disabled}
          className={`flex-1 py-2.5 rounded-full text-sm font-medium transition ${
            disabled
              ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          }`}
        >
          {item.outOfStock ? "Out of stock" : "Add to basket"}
        </button>
      </div>
    </div>
  );
}

// -------------------- Treatments Step --------------------
export default function TreatmentsStep({
  serviceSlug: serviceSlugProp,
  serviceId: serviceIdProp,
  onContinue,
}: {
  serviceSlug?: string;
  serviceId?: string; // optional prop
  onContinue?: () => void;
}) {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const serviceSlug = serviceSlugProp ?? params?.slug;

  // serviceId from prop or query (?serviceId / ?service_id)
  const serviceIdFromQuery =
    searchParams?.get("serviceId") || searchParams?.get("service_id") || "";
  const initialServiceId = (serviceIdProp ?? serviceIdFromQuery) || null;

  // 🔹 This will be the final ID we use to call /service-medicines/service/:id
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

  // Tell the cart drawer where to go when the user hits "Continue"
  useEffect(() => {
    if (!serviceSlug) return;
    const q = new URLSearchParams(searchParams?.toString() ?? "");
    q.set("step", isLoggedIn ? "raf" : "login"); // next step within the wizard
    const bookingNext = `/private-services/${serviceSlug}/book?${q.toString()}`;

    try {
      sessionStorage.setItem("booking_next", bookingNext);
      sessionStorage.setItem("booking_slug", String(serviceSlug));
    } catch {}
  }, [serviceSlug, isLoggedIn, searchParams]);

  const [data, setData] = useState<ApiMedicine[] | null>(null);
  const [loadingMedicines, setLoadingMedicines] = useState(true);
  const [medicineError, setMedicineError] = useState<string | null>(null);

  // -------- 1) Resolve serviceId (prop / query / by slug) --------
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // If already have an ID from prop/query, just use it
      if (initialServiceId) {
        setResolvedServiceId(initialServiceId);
        setServiceResolveError(null);
        return;
      }

      // If no slug, we can't resolve anything
      if (!serviceSlug) return;

      setResolvingService(true);
      setServiceResolveError(null);

      try {
        // 🔹 Use hard-coded URL (via getApiBase) to fetch all services
        const servicesBase = getApiBase(); // default http://localhost:8000/api
        const servicesUrl = `${servicesBase}/services`; // -> http://localhost:8000/api/services

        const res = await fetch(servicesUrl, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `Services API ${res.status}: ${
              txt?.slice(0, 180) || "request failed"
            }`
          );
        }
        const json = await res.json();

        if (cancelled) return;

        // handle both shapes: { data: [...] } or plain array
        let list: ApiService[] = [];
        if (Array.isArray(json?.data)) {
          list = json.data;
        } else if (Array.isArray(json)) {
          list = json;
        }

        const match = list.find((s) => s.slug === serviceSlug);

        if (match?._id) {
          setResolvedServiceId(match._id);
          setServiceResolveError(null);
        } else {
          setResolvedServiceId(null);
          setServiceResolveError(
            `No service found for slug "${serviceSlug}".`
          );
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

    const apiBase = getApiBase();
    const url = `${apiBase}/service-medicines/service/${encodeURIComponent(
      resolvedServiceId
    )}`;

    let mounted = true;
    setLoadingMedicines(true);
    setMedicineError(null);

    fetch(url, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `API ${res.status}: ${txt?.slice(0, 180) || "request failed"}`
          );
        }
        return res.json();
      })
      .then((json: ApiMedicine[]) => {
        if (!mounted) return;
        setData(json);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setMedicineError(`API error for ${url}: ${String(err?.message || err)}`);
        if (typeof window !== "undefined") {
          console.warn("TreatmentsStep fetch failed:", { url, err });
        }
      })
      .finally(() => mounted && setLoadingMedicines(false));

    return () => {
      mounted = false;
    };
  }, [resolvedServiceId]);

  // Map API → UI model
  const uiMedicines: UIMedicine[] = useMemo(() => {
    if (!data?.length) return [];

    const apiOrigin = getApiOrigin();

    return data.map((m) => {
      const unitMinor =
        typeof m.unitMinor === "number" && m.unitMinor > 0
          ? m.unitMinor
          : Math.round((m.price ?? 0) * 100);

      const price = unitMinor / 100;

      const stockQty = typeof m.qty === "number" ? m.qty : 0;

      const minQty =
        (m as any).min ?? (m as any).min_qty ?? 1;

      const maxCandidate =
        (m as any).max ?? (m as any).max_qty ?? stockQty;
      const maxQty =
        typeof maxCandidate === "number" && maxCandidate > 0
          ? maxCandidate
          : undefined;

      const outOfStock =
        (m.status && m.status !== "active") ||
        stockQty <= 0 ||
        (maxQty !== undefined && maxQty <= 0);

      const imageUrl = m.image
        ? m.image.startsWith("http")
          ? m.image
          : `${apiOrigin}${m.image}`
        : "/images/product-placeholder.svg";

      // 🔽 Normalise variations into an array of strings
      let variationOptions: string[] = [];
      if (Array.isArray(m.variations)) {
        variationOptions = m.variations
          .map((v) => (v ?? "").toString().trim())
          .filter(Boolean);
      } else if (typeof m.variations === "string" && m.variations.trim()) {
        // Support pipe/comma/semicolon-separated variations in a single string
        variationOptions = m.variations
          .split(/[|,;/]+/)
          .map((v) => v.trim())
          .filter(Boolean);
      } else if (typeof m.variation === "string" && m.variation.trim()) {
        variationOptions = [m.variation.trim()];
      }

      // Ensure variationText is always a string or undefined (UIMedicine expects string | undefined)
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
      } else {
        variationText = undefined;
      }

      return {
        id: m._id,
        sku: m.sku,
        name: m.name,
        description: m.description,
        strength: m.strength,
        variationText: variationText,
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
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8 pb-10">
      <header className="space-y-1 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold">
          Select your medicines
        </h2>
        <p className="text-sm text-neutral-500">
          Choose the medicines you need for this service and add them to your basket.
        </p>
      </header>

      {showLoading && (
        <div className="text-neutral-600 text-center">
          Loading medicines…
        </div>
      )}

      {!showLoading && serviceResolveError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm text-center">
          {serviceResolveError}
        </div>
      )}

      {!showLoading && !serviceResolveError && !resolvedServiceId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm text-center">
          No service ID resolved. Make sure a valid service exists for this page.
        </div>
      )}

      {medicineError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm text-center">
          {medicineError}
        </div>
      )}

      {!showLoading &&
        !medicineError &&
        resolvedServiceId &&
        uiMedicines.length === 0 && (
          <div className="text-neutral-500 text-center">
            No medicines are configured for this service yet.
          </div>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 justify-items-center">
        {uiMedicines.map((m) => (
          <CatalogProductCard key={m.id} item={m} onAdded={onContinue} />
        ))}
      </div>
    </section>
  );
}
