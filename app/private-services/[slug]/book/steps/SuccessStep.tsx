"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart-context";

/**
 * SuccessStep
 *
 * Same clean layout as other steps, but upgraded with
 * robust success logic
 * - Derives the reference from query or last_payment
 * - Posts a Pending Order to backend once
 * - Clears carts idempotently
 * - Polls order status for payment and booking badges
 */
const API_BASE = ((process.env.NEXT_PUBLIC_API_BASE_URL || "") || "http://127.0.0.1:8000/api").replace(/\/+$/, "");
const API_ORIGIN = API_BASE.replace(/\/api$/, "");
const api = (p: string) => (p.startsWith("/") ? `${API_BASE}${p}` : p);

const DONE_PREFIX = "success_done_";
function wasDone(r: string) {
  try {
    return !!(r && localStorage.getItem(DONE_PREFIX + r));
  } catch {
    return false;
  }
}
function markDone(r: string) {
  try {
    if (r) localStorage.setItem(DONE_PREFIX + r, "1");
  } catch {}
}
function safeJson(s: any) {
  try {
    return s ? JSON.parse(String(s)) : null;
  } catch {
    return null;
  }
}
function toInt(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function toMinor(val: any) {
  if (val == null || val === "") return 0;
  const s = String(val);
  const num = Number(val);
  if (Number.isNaN(num)) return 0;
  return s.includes(".") ? Math.round(num * 100) : Math.round(num);
}

function normalizeItem(i: any) {
  const qty = Math.max(1, Number(i?.qty) || Number(i?.quantity) || 1);

  // prefer explicit variation fields from payload/cart
  let variation: string | null =
    (i?.variations ??
      i?.variation ??
      i?.optionLabel ??
      i?.selectedLabel ??
      i?.label ??
      i?.strength ??
      i?.dose ??
      null) as any;

  // clean base name
  let name = (i?.product?.name || i?.baseName || i?.name || i?.title || "Item")
    .toString()
    .trim();
  const sku = (i?.sku || i?.slug || i?.id || "item").toString();

  if (!variation) {
    const m = /^(.+?)\s+(\d[\s\S]*)$/.exec(name);
    if (m && m[1] && m[2]) {
      name = m[1].trim();
      variation = m[2].trim() || null;
    }
  }

  const unitMinor = toMinor(
    i?.unitMinor ?? i?.priceMinor ?? i?.amountMinor ?? i?.unit_price ?? i?.price ?? 0
  );
  const totalMinor =
    (typeof i?.totalMinor === "number" ? i.totalMinor : undefined) ||
    unitMinor * qty;

  return {
    sku,
    name,
    variations: variation ?? null,
    strength: variation ?? null,
    qty,
    unitMinor,
    totalMinor,
  };
}
function normalizeItems(fromLast: any, fromCart: any[]) {
  const cart: any[] = Array.isArray(fromCart) ? fromCart : [];
  const lastRaw: any[] = Array.isArray(fromLast) ? fromLast : [];

  const last = cart.length
    ? lastRaw.filter((r) => {
        const sku = String(r?.sku || "");
        const variations = String(r?.variations ?? r?.variation ?? "");
        const looksCombined = sku === "item" || variations.includes(" • ");
        return !looksCombined;
      })
    : lastRaw;

  const merged = [...cart, ...last];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const raw of merged) {
    const i = normalizeItem(raw);
    const key = `${i.sku}::${i.variations || ""}::${i.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(i);
    }
  }
  return out;
}

export default function SuccessStep() {
  const search = useSearchParams();
  const { clear: clearCart } = useCart();

  const [cleared, setCleared] = useState(false);
  const clearingRef = useRef(false);

  // Derive ref from URL or last_payment
  const ref = useMemo(() => {
    try {
      const last = safeJson(
        typeof window !== "undefined" ? localStorage.getItem("last_payment") : null
      );
      const paramRef =
        (search.get("ref") ||
          search.get("reference") ||
          search.get("order") ||
          search.get("orderId") ||
          "") + "";
      const lastRef = last?.ref || "";
      return paramRef || lastRef;
    } catch {
      return (
        (search.get("ref") ||
          search.get("reference") ||
          search.get("order") ||
          search.get("orderId") ||
          "") + ""
      );
    }
  }, [search]);

  const type = useMemo(() => {
    try {
      const last = safeJson(
        typeof window !== "undefined" ? localStorage.getItem("last_payment") : null
      );
      const raw = (last?.type || search.get("type") || "")
        .toString()
        .toLowerCase()
        .trim();
      if (["new", "transfer", "current", "reorder", "consultation"].includes(raw)) return raw as any;
      return raw === "consult" ? "consultation" : "new";
    } catch {
      return "new";
    }
  }, [search]) as "new" | "transfer" | "current" | "reorder" | "consultation";

  const email = (search.get("email") || "") + "";
  const slug = (search.get("slug") || "") + "";

  // Appointment date and time extraction
  const startISO = useMemo(() => {
    const candidates: (string | null)[] = [
      search.get('start_at'),
      search.get('startAt'),
      search.get('start'),
      search.get('slot'),
      search.get('appointment'),
    ];
    let iso = (candidates.find(v => v && /^\d{4}-\d{2}-\d{2}T/.test(v)) || '') as string;

    // Pair of date + time in query params
    if (!iso) {
      const d = (search.get('date') || '').toString().trim();
      const t = (search.get('time') || '').toString().trim();
      if (d && t) {
        iso = `${d}T${t.length === 5 ? t : t.padStart(5, '0')}`;
      }
    }

    // Fallback to storage keys
    if (!iso && typeof window !== 'undefined') {
      const keys = [
        'appointment_at',
        'appointment_start',
        'booking_start',
        'selected_slot_iso',
        'selected_time_iso',
        'selected_slot',
      ];
      for (const k of keys) {
        try {
          const v =
            localStorage.getItem(k) ||
            sessionStorage.getItem(k) ||
            '';
          if (v && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
            iso = v;
            break;
          }
        } catch {}
      }
      if (!iso) {
        try {
          const d = localStorage.getItem('appointment_date') || '';
          const t = localStorage.getItem('appointment_time') || '';
          if (d && t) iso = `${d}T${t.length === 5 ? t : t.padStart(5, '0')}`;
        } catch {}
      }
    }

    return iso;
  }, [search]);

  const appointmentLabel = useMemo(() => {
    if (!startISO) return '';
    try {
      const d = new Date(startISO);
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Europe/London',
      }).format(d);
    } catch {
      return '';
    }
  }, [startISO]);

  // Status polling
  const [paymentStatus, setPaymentStatus] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [polling, setPolling] = useState(false);
  const postedOnceRef = useRef(false);
  const startedRef = useRef(false);

  // Post lightweight pending order + clear carts idempotently
  useEffect(() => {
    try {
      if (!ref) return;
      if (postedOnceRef.current) return;
      if (wasDone(ref)) return;
      postedOnceRef.current = true;

      const last = safeJson(localStorage.getItem("last_payment"));
      const sessionId =
        last?.sessionId ||
        last?.session_id ||
        last?.session ||
        safeJson(localStorage.getItem("consultation_session_id")) ||
        null;

      const lastItems: any[] =
        (Array.isArray(last?.items)
          ? last.items
          : Array.isArray(last?.meta?.items)
          ? last.meta.items
          : []) || [];

      const cartArr: any[] = safeJson(localStorage.getItem("pe_cart_v1")) || [];

      // Clear local carts
      if (!clearingRef.current) {
        const key = ref ? `cart-cleared:${ref}` : "cart-cleared:generic";
        const already = sessionStorage.getItem(key);
        if (!already) {
          clearingRef.current = true;
          try {
            clearCart?.();
            localStorage.removeItem("pe_cart_v1");
            localStorage.removeItem("guest_cart_v1");
            localStorage.removeItem("cart");
            localStorage.setItem("clear_cart", "1");
            window.dispatchEvent(new Event("cart:clear"));
            sessionStorage.setItem(key, "1");
            setCleared(true);
          } catch {
          } finally {
            clearingRef.current = false;
          }
        } else {
          setCleared(true);
        }
      }

      let items = normalizeItems(lastItems, cartArr);

      if (!items.length) {
        const qty = Math.max(1, toInt(search.get("qty")) || 1);
        const unitMinor = toInt(search.get("unitMinor")) || 0;
        const nameRaw = (search.get("treatment") || search.get("name") || "Item")
          .toString()
          .trim();
        items = [
          normalizeItem({ sku: "item", name: nameRaw, qty, unitMinor }),
        ];
      }

      const postedItems = items.slice();
      const amountMinor =
        toInt(last?.amountMinor) ||
        toInt(search.get("amountMinor")) ||
        toInt(search.get("totalMinor")) ||
        postedItems.reduce(
          (s, it) =>
            s + (it.totalMinor ?? it.unitMinor * Math.max(1, it.qty || 1)),
          0
        );

      // Capture end time and include service slug
      const endISO =
        (search.get("end_at") || "") + "" ||
        (typeof window !== "undefined"
          ? localStorage.getItem("appointment_end_at") ||
            sessionStorage.getItem("appointment_end_at") ||
            ""
          : "");

      const body = {
        ref,
        amountMinor,
        paid: true,
        type,
        createdAt: new Date().toISOString(),
        items: postedItems,
        lines: postedItems.map((i, idx) => ({
          index: idx,
          name: i.name,
          qty: i.qty,
          variation: i.variations ?? null,
          unitMinor: i.unitMinor,
          priceMinor: i.unitMinor,
          totalMinor: i.totalMinor ?? i.unitMinor * Math.max(1, i.qty || 1),
        })),
        token:
          localStorage.getItem("token") ||
          localStorage.getItem("auth_token") ||
          undefined,
        sessionId,
        // appointment info for backend
        appointment_start_at: startISO || undefined,
        appointment_at: startISO || undefined, // legacy alias
        appointment_end_at: endISO || undefined,
        // service identity to help API stamp meta correctly
        service_slug: slug || undefined,
      };

      // Fire and forget to Next API proxy
      (async () => {
        try {
          await fetch("/api/orders/pending", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
          });
        } catch {}
      })();

      // Stash a lightweight local order preview for account list
      const localOrder = {
        id: ref || `temp-${Date.now()}`,
        reference: ref || undefined,
        createdAt: new Date().toISOString(),
        status: "Pending",
        totalMinor: amountMinor,
        items: postedItems.map((i) => ({
          sku: i.sku || "item",
          name: i.name,
          variations: i.variations ?? null,
          variation: i.variations ?? null,
          strength: i.variations ?? null,
          qty: i.qty,
          unitMinor: i.unitMinor,
          totalMinor: i.totalMinor ?? i.unitMinor * Math.max(1, i.qty || 1),
        })),
      };
      const key = "local_orders";
      const prev: any[] = safeJson(localStorage.getItem(key)) || [];
      const refKey = String(localOrder.reference || localOrder.id || "");
      const dedup = (Array.isArray(prev) ? prev : []).filter(
        (p) => String(p?.reference || p?.id || "") !== refKey
      );
      const next = [localOrder, ...dedup].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(next));
      try {
        window.dispatchEvent(new Event("orders:updated"));
      } catch {}

      markDone(ref);
      try {
        localStorage.removeItem("last_payment");
      } catch {}
      try {
        sessionStorage.removeItem("pe_selected_treatments");
      } catch {}
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, type, search]);

  // Poll order status for badges
  useEffect(() => {
    if (!ref) return;
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let iv: any = null;

    const fetchOrder = async () => {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("token") ||
            localStorage.getItem("auth_token") ||
            ""
          : "";
      const url = api(`/account/orders/by-ref/${encodeURIComponent(ref)}`);
      try {
        const r = await fetch(url, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });
        if (!r.ok || cancelled) return;
        const data = await r.json();
        const pay = String(data?.payment_status || "");
        const book = String(data?.booking_status || "");
        setPaymentStatus(pay);
        setBookingStatus(book);

        if (pay === "paid" && (book === "approved" || book === "rejected" || book === "")) {
          if (iv) clearInterval(iv);
          setPolling(false);
        }
      } catch {}
    };

    fetchOrder();
    setPolling(true);

    let tries = 0;
    iv = setInterval(() => {
      if (cancelled) return;
      tries += 1;
      if (tries > 8) {
        clearInterval(iv);
        setPolling(false);
        return;
      }
      fetchOrder();
    }, 2000);

    return () => {
      cancelled = true;
      if (iv) clearInterval(iv);
      setPolling(false);
    };
  }, [ref]);

  const title = useMemo(
    () => (ref ? "Payment complete" : "All done"),
    [ref]
  );

  const subtitle = useMemo(() => {
    if (ref && email) {
      return `We have emailed your receipt and booking confirmation to ${email}.`;
    }
    if (ref) {
      return "We will email your receipt and booking confirmation once the pharmacist approves your order.";
    }
    return "Thank you your booking has been received.";
  }, [ref, email]);

  return (
    <>
      <div
        className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
        data-hide-in-progress="true"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 text-emerald-600"
              aria-hidden="true"
            >
              <path
                d="M20 7L9 18l-5-5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <div>
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="text-gray-600">{subtitle}</p>
          </div>
        </div>

        {/* Details card */}
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ref ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">Reference</dt>
                <dd className="text-lg font-semibold tracking-wide">{ref}</dd>
                <div className="mt-2 flex flex-wrap gap-2">
                  {paymentStatus ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ${
                        paymentStatus === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : paymentStatus === "refunded"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {paymentStatus === "paid"
                        ? "Paid"
                        : paymentStatus === "refunded"
                        ? "Refunded"
                        : paymentStatus}
                    </span>
                  ) : null}
                  {bookingStatus === "pending" && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-amber-100 text-amber-800">
                      Pending approval
                    </span>
                  )}
                  {bookingStatus === "approved" && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-emerald-100 text-emerald-800">
                      Approved
                    </span>
                  )}
                  {bookingStatus === "rejected" && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-rose-100 text-rose-800">
                      Not approved
                    </span>
                  )}
                  {polling && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-gray-100 text-gray-700">
                      Updating
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {appointmentLabel ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">Appointment</dt>
                <dd className="text-lg">{appointmentLabel}</dd>
              </div>
            ) : null}

            {email ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">Receipt sent to</dt>
                <dd className="text-lg">{email}</dd>
              </div>
            ) : null}

            {slug ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">Service</dt>
                <dd className="text-lg">{slug}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/account?tab=orders&refresh=1"
            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-white hover:bg-emerald-700"
          >
            View booking
          </Link>

          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-5 py-2.5 text-gray-900 hover:bg-gray-50"
          >
            Back to home
          </Link>

          {slug ? (
            <Link
              href={`/private-services/${slug}/book?step=treatments`}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-5 py-2.5 text-gray-900 hover:bg-gray-50"
            >
              Book another treatment
            </Link>
          ) : null}
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Keep this page open for your records, or check your email for the receipt and next steps.
        </p>
      </div>
    </>
  );
}