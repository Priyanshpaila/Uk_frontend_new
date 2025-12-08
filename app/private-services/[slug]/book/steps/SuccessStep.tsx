"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";

import {
  safeParseJson,
  mergePaymentItemsFromSources,
  normalisePaymentItem,
  toInt,
  postPendingOrderOnce,
  buildLocalOrderPreview,
  storeLocalOrderPreview,
  fetchOrderByReferenceApi,
  getOrderByIdApi,
  type LastPaymentItem,
  type OrderDto,
} from "@/lib/api";

type SummaryRow = { label: string; value: string };

// minor (pence) → "£12.34"
function formatMinorGBP(minor?: number | null): string {
  if (minor == null || Number.isNaN(minor)) return "£0.00";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

// booking type label – accepts any string, defaults to "New treatment"
function humanTypeLabel(rawType: string | null | undefined) {
  const type = (rawType || "").toString().toLowerCase();

  switch (type) {
    case "transfer":
      return "Prescription transfer";
    case "current":
      return "Existing prescription";
    case "reorder":
      return "Repeat / reorder";
    case "consultation":
    case "consult":
      return "Consultation";
    case "new":
    default:
      return "New treatment";
  }
}

/**
 * SuccessStep
 *
 * - Derives `ref` from query or last_payment
 * - Posts /api/orders/pending ONCE per ref (legacy flow)
 * - Clears cart idempotently
 * - Polls backend /account/orders/by-ref/:ref for statuses
 * - Fetches full order by id (GET /orders/:id) and renders invoice
 */
export default function SuccessStep() {
  const search = useSearchParams();
  const { clearCart } = useCart();

  const [cleared, setCleared] = useState(false);
  const clearingRef = useRef(false);

  // ---- Reference from URL or last_payment ----
  const ref = useMemo(() => {
    try {
      const last =
        typeof window !== "undefined"
          ? safeParseJson<any>(window.localStorage.getItem("last_payment"))
          : null;

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

  // ---- Order ID from query or localStorage ----
  const orderId = useMemo(() => {
    let id =
      (search.get("order") || search.get("orderId") || search.get("id") || "") +
      "";
    if (!id && typeof window !== "undefined") {
      try {
        id = window.localStorage.getItem("order_id") || "";
      } catch {
        // ignore
      }
    }
    return id;
  }, [search]);

  // booking type from last_payment / query (can be overridden by order.order_type)
  const baseType = useMemo(() => {
    try {
      const last =
        typeof window !== "undefined"
          ? safeParseJson<any>(window.localStorage.getItem("last_payment"))
          : null;

      const raw = (last?.type || search.get("type") || "")
        .toString()
        .toLowerCase()
        .trim();

      if (
        ["new", "transfer", "current", "reorder", "consultation"].includes(raw)
      ) {
        return raw;
      }
      return raw === "consult" ? "consultation" : "new";
    } catch {
      return "new";
    }
  }, [search]) as string;

  const emailFromQuery = (search.get("email") || "") + "";
  const slugFromQuery = (search.get("slug") || "") + "";

  // ---- Appointment date/time ----
  const startISO = useMemo(() => {
    const candidates: (string | null)[] = [
      search.get("start_at"),
      search.get("startAt"),
      search.get("start"),
      search.get("slot"),
      search.get("appointment"),
    ];
    let iso =
      (candidates.find((v) => v && /^\d{4}-\d{2}-\d{2}T/.test(v)) || "") as
        | string
        | undefined;

    if (!iso) {
      const d = (search.get("date") || "").toString().trim();
      const t = (search.get("time") || "").toString().trim();
      if (d && t) {
        iso = `${d}T${t.length === 5 ? t : t.padStart(5, "0")}`;
      }
    }

    if (!iso && typeof window !== "undefined") {
      const keys = [
        "appointment_at",
        "appointment_start",
        "booking_start",
        "selected_slot_iso",
        "selected_time_iso",
        "selected_slot",
      ];
      for (const k of keys) {
        try {
          const v =
            window.localStorage.getItem(k) ||
            window.sessionStorage.getItem(k) ||
            "";
          if (v && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
            iso = v;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (!iso) {
        try {
          const d = window.localStorage.getItem("appointment_date") || "";
          const t = window.localStorage.getItem("appointment_time") || "";
          if (d && t) {
            iso = `${d}T${t.length === 5 ? t : t.padStart(5, "0")}`;
          }
        } catch {
          // ignore
        }
      }
    }

    return iso || "";
  }, [search]);

  const appointmentLabel = useMemo(() => {
    if (!startISO) return "";
    try {
      const d = new Date(startISO);
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      }).format(d);
    } catch {
      return "";
    }
  }, [startISO]);

  const invoiceDateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return "";
    }
  }, []);

  // ---- Status & invoice state ----
  const [paymentStatus, setPaymentStatus] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [polling, setPolling] = useState(false);

  const [invoiceItems, setInvoiceItems] = useState<LastPaymentItem[]>([]);
  const [invoiceTotalMinor, setInvoiceTotalMinor] = useState<number | null>(
    null
  );
  const [patient, setPatient] = useState<{ name?: string; email?: string }>({});
  const [summaryAnswers, setSummaryAnswers] = useState<SummaryRow[]>([]);
  const [orderTypeOverride, setOrderTypeOverride] = useState<string | null>(
    null
  );
  const [serviceNameFromOrder, setServiceNameFromOrder] = useState<
    string | null
  >(null);

  // derive patient from localStorage ("user"/"pharmacy_user")
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawUser =
        window.localStorage.getItem("pharmacy_user") ||
        window.localStorage.getItem("user") ||
        "";
      if (!rawUser) return;

      const parsed = safeParseJson<any>(rawUser);
      const u = parsed?.user || parsed || {};

      const first =
        u.firstName || u.first_name || u.givenName || u.given_name || "";
      const last = u.lastName || u.last_name || "";
      const name =
        (first || last ? `${first} ${last}`.trim() : "") ||
        u.name ||
        u.fullName ||
        u.full_name ||
        undefined;

      const email =
        u.email ||
        u.username ||
        (typeof u.contact === "object" ? u.contact?.email : undefined);

      setPatient({
        name,
        email,
      });
    } catch {
      // ignore
    }
  }, []);

  // ---- RAF / assessment answers summary ----
  useEffect(() => {
    const slug =
      slugFromQuery ||
      (typeof window !== "undefined"
        ? window.localStorage.getItem("service_slug") || ""
        : "");

    if (!slug || typeof window === "undefined") return;

    try {
      const labelsRaw =
        window.localStorage.getItem(`raf_labels.${slug}`) || "";
      const answersRaw =
        window.localStorage.getItem(`assessmentanswers.${slug}`) ||
        window.localStorage.getItem(`raf.answers.${slug}`) ||
        window.localStorage.getItem(`raf_answers.${slug}`) ||
        "";

      const labels = labelsRaw ? safeParseJson<any>(labelsRaw) || {} : {};
      const answers = answersRaw ? safeParseJson<any>(answersRaw) || {} : {};

      const rows: SummaryRow[] = [];

      if (answers && typeof answers === "object") {
        for (const key of Object.keys(answers)) {
          const label =
            labels?.[key]?.label ||
            labels?.[key]?.title ||
            labels?.[key] ||
            key;

          const val = answers[key];
          let value = "";
          if (Array.isArray(val)) {
            value = val.join(", ");
          } else if (val != null && typeof val === "object") {
            if ("label" in val) value = String(val.label);
            else if ("value" in val) value = String(val.value);
            else value = JSON.stringify(val);
          } else if (val != null) {
            value = String(val);
          }

          if (!value) continue;
          rows.push({ label, value });
        }
      }

      setSummaryAnswers(rows);
    } catch {
      // ignore – not critical
    }
  }, [slugFromQuery]);

  /* ------------------------------------------------------------------ */
  /*   Post pending order ONCE per ref + clear cart + local preview     */
  /*   (legacy: still used as fallback if no proper order is present)   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!ref) return;

    const run = async () => {
      try {
        // Clear carts idempotently (per ref)
        if (!clearingRef.current && typeof window !== "undefined") {
          const key = `cart-cleared:${ref}`;
          const already = window.sessionStorage.getItem(key);
          if (!already) {
            clearingRef.current = true;
            try {
              clearCart?.();
              window.localStorage.removeItem("pe_cart_v1");
              window.localStorage.removeItem("guest_cart_v1");
              window.localStorage.removeItem("cart");
              window.localStorage.setItem("clear_cart", "1");
              window.dispatchEvent(new Event("cart:clear"));
              window.sessionStorage.setItem(key, "1");
              setCleared(true);
            } catch {
              // ignore
            } finally {
              clearingRef.current = false;
            }
          } else {
            setCleared(true);
          }
        }

        // Read last_payment + cart
        const last =
          typeof window !== "undefined"
            ? safeParseJson<any>(window.localStorage.getItem("last_payment"))
            : null;

        const lastItems: any[] =
          (Array.isArray(last?.items)
            ? last.items
            : Array.isArray(last?.meta?.items)
            ? last.meta.items
            : []) || [];

        const cartArr: any[] =
          typeof window !== "undefined"
            ? safeParseJson<any[]>(window.localStorage.getItem("pe_cart_v1")) ||
              []
            : [];

        // Build items from last_payment + cart
        let items: LastPaymentItem[] = mergePaymentItemsFromSources(
          lastItems,
          cartArr
        );

        // Fallback: build a minimal single item from query params
        if (!items.length) {
          const qty = Math.max(1, toInt(search.get("qty")) || 1);
          const unitMinor = toInt(search.get("unitMinor")) || 0;
          const nameRaw = (
            search.get("treatment") ||
            search.get("name") ||
            "Item"
          )
            .toString()
            .trim();

          items = [
            normalisePaymentItem({
              sku: "item",
              name: nameRaw,
              qty,
              unitMinor,
            }),
          ];
        }

        const amountMinor =
          toInt(last?.amountMinor) ||
          toInt(search.get("amountMinor")) ||
          toInt(search.get("totalMinor")) ||
          items.reduce(
            (s, it) =>
              s +
              (it.totalMinor ??
                it.unitMinor * Math.max(1, it.qty || 1)),
            0
          );

        // End time (if any)
        const endISO =
          ((search.get("end_at") || "") + "") ||
          (typeof window !== "undefined"
            ? window.localStorage.getItem("appointment_end_at") ||
              window.sessionStorage.getItem("appointment_end_at") ||
              ""
            : "");

        const sessionId =
          last?.sessionId ||
          last?.session_id ||
          last?.session ||
          (typeof window !== "undefined"
            ? window.localStorage.getItem("consultation_session_id") ||
              window.sessionStorage.getItem("consultation_session_id") ||
              null
            : null);

        const slug =
          slugFromQuery ||
          (typeof window !== "undefined"
            ? window.localStorage.getItem("service_slug") || ""
            : "");

        const body = {
          ref,
          amountMinor,
          paid: true,
          type: baseType,
          createdAt: new Date().toISOString(),
          items,
          lines: items.map((i, idx) => ({
            index: idx,
            name: i.name,
            qty: i.qty,
            variation: i.variations ?? null,
            unitMinor: i.unitMinor,
            priceMinor: i.unitMinor,
            totalMinor:
              i.totalMinor ?? i.unitMinor * Math.max(1, i.qty || 1),
          })),
          token:
            typeof window !== "undefined"
              ? window.localStorage.getItem("token") ||
                window.localStorage.getItem("auth_token") ||
                undefined
              : undefined,
          sessionId,
          appointment_start_at: startISO || undefined,
          appointment_at: startISO || undefined, // legacy alias
          appointment_end_at: endISO || undefined,
          service_slug: slug || undefined,
        };

        // 🔒 Idempotent: this will only POST once per ref
        await postPendingOrderOnce(ref, body);

        // Store a tiny local preview used by /account?tab=orders
        const localOrder = buildLocalOrderPreview({
          ref,
          amountMinor,
          items,
        });
        storeLocalOrderPreview(localOrder);

        // Expose to invoice UI as a fallback (will be overridden by /orders/:id if present)
        setInvoiceItems(items);
        setInvoiceTotalMinor(amountMinor);

        // Clean up transient client-side data
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("last_payment");
          window.sessionStorage.removeItem("pe_selected_treatments");
        }
      } catch {
        // ignore – user still sees success, backend can be retried later
      }
    };

    run();
  }, [ref, baseType, slugFromQuery, startISO, search, clearCart]);

  /* ------------------------------------------------------------------ */
  /*           Fetch full order details by ID for accurate invoice      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    const run = async () => {
      try {
        const order: OrderDto = await getOrderByIdApi(orderId);
        if (cancelled || !order) return;

        const meta: any = (order as any).meta || {};

        // booking type & service from backend
        if (typeof (order as any).order_type === "string") {
          setOrderTypeOverride((order as any).order_type);
        }
        if (meta.service) {
          setServiceNameFromOrder(String(meta.service));
        }

        // payment / booking status
        if ((order as any).payment_status) {
          setPaymentStatus(String((order as any).payment_status));
        }
        if ((order as any).booking_status) {
          setBookingStatus(String((order as any).booking_status));
        }

        // items from meta.items or meta.lines
        let fromOrderItems: LastPaymentItem[] = [];

        if (Array.isArray(meta.items) && meta.items.length) {
          fromOrderItems = meta.items.map((it: any) =>
            normalisePaymentItem({
              sku: it.sku || it.name || "item",
              name: it.name || "Item",
              qty: Number(it.qty || 1),
              unitMinor: Number(
                it.unitMinor ??
                  it.unit_minor ??
                  it.priceMinor ??
                  it.price_minor ??
                  0
              ),
              totalMinor:
                typeof it.totalMinor === "number"
                  ? it.totalMinor
                  : typeof it.total_minor === "number"
                  ? it.total_minor
                  : undefined,
              variations: it.variation || it.variations || null,
            })
          );
        } else if (Array.isArray(meta.lines) && meta.lines.length) {
          fromOrderItems = meta.lines.map((ln: any) =>
            normalisePaymentItem({
              sku: ln.sku || ln.name || "item",
              name: ln.name || "Item",
              qty: Number(ln.qty || 1),
              unitMinor: 0,
              totalMinor: undefined,
              variations: ln.variation || ln.variations || null,
            })
          );
        }

        if (fromOrderItems.length) {
          setInvoiceItems(fromOrderItems);

          let totalMinor: number | null = null;
          if (typeof meta.totalMinor === "number") {
            totalMinor = meta.totalMinor;
          } else if (typeof (order as any).amountMinor === "number") {
            totalMinor = (order as any).amountMinor;
          } else {
            totalMinor = fromOrderItems.reduce(
              (s, it) =>
                s +
                (it.totalMinor ??
                  it.unitMinor * Math.max(1, it.qty || 1)),
              0
            );
          }
          setInvoiceTotalMinor(totalMinor);
        }
      } catch {
        // ignore – falls back to local preview
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  /* ------------------------------------------------------------------ */
  /*                   Poll backend for order status (ref)              */
  /*   (still useful if another system updates payment/booking later)   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!ref) return;

    let cancelled = false;
    let iv: any = null;

    const fetchOrder = async () => {
      try {
        const data = await fetchOrderByReferenceApi(ref);
        if (cancelled || !data) return;

        const pay = String(data?.payment_status || "");
        const book = String(data?.booking_status || "");

        // Only update if we don't already have a value from /orders/:id
        setPaymentStatus((prev) => prev || pay);
        setBookingStatus((prev) => prev || book);

        if (
          pay === "paid" &&
          (book === "approved" ||
            book === "rejected" ||
            book === "")
        ) {
          if (iv) clearInterval(iv);
          setPolling(false);
        }
      } catch {
        // ignore
      }
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

  const patientEmail = emailFromQuery || patient.email || "";

  const subtitle = useMemo(() => {
    const emailDisplay = patientEmail;
    if (ref && emailDisplay) {
      return `We’ve emailed your receipt and booking confirmation to ${emailDisplay}.`;
    }
    if (ref) {
      return "We will email your receipt and booking confirmation once the pharmacist approves your order.";
    }
    return "Thank you, your booking has been received.";
  }, [ref, patientEmail]);

  const totalMinor =
    invoiceTotalMinor ??
    invoiceItems.reduce(
      (s, it) =>
        s +
        (it.totalMinor ?? it.unitMinor * Math.max(1, it.qty || 1)),
      0
    );

  const bookingTypeForUi = orderTypeOverride || baseType;

  const serviceSlug =
    slugFromQuery ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("service_slug") || ""
      : "");
  const serviceDisplay =
    serviceNameFromOrder ||
    (serviceSlug ? serviceSlug.replace(/-/g, " ") : "");

  return (
    <div className="mx-auto max-w-4xl" data-hide-in-progress="true">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft-card">
        {/* Header / ribbon */}
        <header className="flex flex-col gap-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-cyan-500 px-6 py-5 text-white md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7"
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
            </div>
            <div>
              <h2 className="text-xl font-semibold md:text-2xl">
                {appointmentLabel ? "Booking confirmed" : title}
              </h2>
              <p className="mt-1 text-xs text-emerald-50/90 md:text-sm">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 text-xs md:items-end md:text-sm">
            <span className="rounded-full bg-black/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50">
              Invoice &amp; booking summary
            </span>
            {ref && (
              <span className="text-emerald-50/90">
                Reference:{" "}
                <span className="font-semibold tracking-wide">
                  {ref}
                </span>
              </span>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {paymentStatus && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    paymentStatus === "paid"
                      ? "bg-emerald-100/90 text-emerald-900"
                      : paymentStatus === "refunded"
                      ? "bg-rose-100 text-rose-900"
                      : "bg-white/20 text-white"
                  }`}
                >
                  {paymentStatus === "paid"
                    ? "Paid"
                    : paymentStatus === "refunded"
                    ? "Refunded"
                    : paymentStatus}
                </span>
              )}
              {bookingStatus === "pending" && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-900">
                  Pending clinical review
                </span>
              )}
              {bookingStatus === "approved" && (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-900">
                  Appointment confirmed
                </span>
              )}
              {bookingStatus === "rejected" && (
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-900">
                  Not approved
                </span>
              )}
              {polling && (
                <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-emerald-50">
                  Updating status…
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Body */}
        <section className="space-y-6 px-6 py-6 md:px-8 md:py-7">
          {/* Provider / Patient block */}
          <div className="grid gap-6 text-xs md:grid-cols-2 md:text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Provider
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 md:text-base">
                Pharmacy Express
              </p>
              <p className="text-xs text-slate-600 md:text-sm">
                Private Clinic &amp; Online Pharmacy
              </p>
              {serviceDisplay && (
                <p className="mt-1 text-xs text-slate-500">
                  Service:{" "}
                  <span className="font-medium text-slate-800">
                    {serviceDisplay}
                  </span>
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                Your clinician will review this booking and contact you
                if anything else is needed.
              </p>
            </div>

            <div className="md:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Patient
              </p>
              {patient.name && (
                <p className="mt-1 text-sm font-semibold text-slate-900 md:text-base">
                  {patient.name}
                </p>
              )}
              {patientEmail && (
                <p className="text-xs text-slate-600 md:text-sm">
                  {patientEmail}
                </p>
              )}
              <p className="mt-1 text-[11px] text-slate-500">
                Please bring a photo ID if attending in person.
              </p>
            </div>
          </div>

          {/* Meta row */}
          <div className="rounded-2xl border border-slate-100 bg-white/80 px-4 py-3">
            <dl className="grid grid-cols-1 gap-4 text-xs md:grid-cols-4 md:text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Booking type
                </dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {humanTypeLabel(bookingTypeForUi)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                  Invoice date
                </dt>
                <dd className="mt-0.5 text-slate-800">
                  {invoiceDateLabel}
                </dd>
              </div>
              {appointmentLabel && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    Appointment
                  </dt>
                  <dd className="mt-0.5 text-slate-800">
                    {appointmentLabel}
                  </dd>
                </div>
              )}
              {ref && (
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
                    Reference
                  </dt>
                  <dd className="mt-0.5 font-mono text-[11px] text-slate-800 md:text-xs">
                    {ref}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white/70">
            <div className="border-b border-slate-100 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Order summary
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">
                      Item
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">
                      Details
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">
                      Price
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-slate-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.length > 0 ? (
                    invoiceItems.map((it, idx) => {
                      const qty = Math.max(1, it.qty || 1);
                      const unitMinor = it.unitMinor || 0;
                      const lineTotal =
                        it.totalMinor ?? unitMinor * qty;
                      const variation =
                        (it as any).variations ||
                        (it as any).variation ||
                        "";

                      return (
                        <tr
                          key={`${it.sku || it.name || idx}-${idx}`}
                          className={
                            idx % 2 === 1
                              ? "bg-slate-50/60"
                              : "bg-transparent"
                          }
                        >
                          <td className="px-4 py-2 align-top font-medium text-slate-900">
                            {it.name || "Treatment"}
                          </td>
                          <td className="px-4 py-2 align-top text-slate-600">
                            {variation || "—"}
                          </td>
                          <td className="px-4 py-2 text-right align-top text-slate-700">
                            {qty}
                          </td>
                          <td className="px-4 py-2 text-right align-top text-slate-700">
                            {formatMinorGBP(unitMinor)}
                          </td>
                          <td className="px-4 py-2 text-right align-top font-medium text-slate-900">
                            {formatMinorGBP(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        className="px-4 py-4 text-sm text-slate-600"
                        colSpan={5}
                      >
                        Your booking has been recorded. Item details were
                        not available locally, but will appear in your
                        order history.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-col items-end gap-1 text-xs md:text-sm">
                <div className="flex w-full max-w-xs justify-between gap-6 text-slate-700 md:w-auto">
                  <span>Subtotal</span>
                  <span>{formatMinorGBP(totalMinor)}</span>
                </div>
                <div className="flex w-full max-w-xs justify-between gap-6 font-semibold text-slate-900 md:w-auto">
                  <span>Total paid</span>
                  <span>{formatMinorGBP(totalMinor)}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  All prices include any applicable taxes and clinic
                  fees.
                </p>
              </div>
            </div>
          </div>

          {/* Medical answers summary (optional) */}
          {summaryAnswers.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Medical answers (summary)
                </p>
                <span className="text-[11px] text-slate-500">
                  Shared securely with our clinicians only
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-xs md:grid-cols-2 md:text-sm">
                {summaryAnswers.map((row, idx) => (
                  <div key={`${row.label}-${idx}`}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                      {row.label}
                    </dt>
                    <dd className="mt-0.5 text-slate-900">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/account?tab=orders&refresh=1"
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              View booking &amp; receipt
            </Link>

            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Back to home
            </Link>

            {serviceSlug && (
              <Link
                href={`/private-services/${serviceSlug}/book?step=treatments`}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                Book another treatment
              </Link>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            You can safely close this page once you&apos;ve saved or
            printed it. A copy of this invoice and your booking details
            will also be available in your account.
          </p>
        </section>
      </div>
    </div>
  );
}
