// app/private-services/[slug]/book/steps/SuccessStep.tsx
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
  type LastPaymentItem,
} from "@/lib/api";

/**
 * SuccessStep
 *
 * - Derives `ref` from query or last_payment
 * - Builds a pending-order payload
 * - Posts /api/orders/pending ONCE per ref (idempotent)
 * - Clears cart idempotently
 * - Polls backend /account/orders/by-ref/:ref for statuses
 */
export default function SuccessStep() {
  const search = useSearchParams();
  const {  clearCart } = useCart();

  const [cleared, setCleared] = useState(false);
  const clearingRef = useRef(false);

  // ---- Reference from URL or last_payment ----
  const ref = useMemo(() => {
    try {
      const last =
        typeof window !== "undefined"
          ? safeParseJson<any>(
              window.localStorage.getItem("last_payment")
            )
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

  const type = useMemo(() => {
    try {
      const last =
        typeof window !== "undefined"
          ? safeParseJson<any>(
              window.localStorage.getItem("last_payment")
            )
          : null;

      const raw = (last?.type || search.get("type") || "")
        .toString()
        .toLowerCase()
        .trim();

      if (
        ["new", "transfer", "current", "reorder", "consultation"].includes(
          raw
        )
      ) {
        return raw as
          | "new"
          | "transfer"
          | "current"
          | "reorder"
          | "consultation";
      }
      return raw === "consult" ? "consultation" : "new";
    } catch {
      return "new";
    }
  }, [search]) as
    | "new"
    | "transfer"
    | "current"
    | "reorder"
    | "consultation";

  const email = (search.get("email") || "") + "";
  const slug = (search.get("slug") || "") + "";

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
      (candidates.find((v) => v && /^\d{4}-\d{2}-\d{2}T/.test(v)) ||
        "") as string;

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
          const d =
            window.localStorage.getItem("appointment_date") || "";
          const t =
            window.localStorage.getItem("appointment_time") || "";
          if (d && t) {
            iso = `${d}T${t.length === 5 ? t : t.padStart(5, "0")}`;
          }
        } catch {
          // ignore
        }
      }
    }

    return iso;
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

  // ---- Status polling ----
  const [paymentStatus, setPaymentStatus] = useState("");
  const [bookingStatus, setBookingStatus] = useState("");
  const [polling, setPolling] = useState(false);

  /* ------------------------------------------------------------------ */
  /*   Post pending order ONCE per ref + clear cart + local preview     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!ref) return;

    const run = async () => {
      try {
        // Clear carts idempotently (per ref) so test success doesn't
        // keep re-clearing.
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
            ? safeParseJson<any>(
                window.localStorage.getItem("last_payment")
              )
            : null;

        const lastItems: any[] =
          (Array.isArray(last?.items)
            ? last.items
            : Array.isArray(last?.meta?.items)
            ? last.meta.items
            : []) || [];

        const cartArr: any[] =
          typeof window !== "undefined"
            ? safeParseJson<any[]>(
                window.localStorage.getItem("pe_cart_v1")
              ) || []
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
            ? window.localStorage.getItem(
                "consultation_session_id"
              ) ||
              window.sessionStorage.getItem(
                "consultation_session_id"
              ) ||
              null
            : null);

        const body = {
          ref,
          amountMinor,
          paid: true,
          type,
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
              i.totalMinor ??
              i.unitMinor * Math.max(1, i.qty || 1),
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
  }, [ref, type, slug, startISO, search, clearCart]);

  /* ------------------------------------------------------------------ */
  /*                   Poll backend for order status                     */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!ref) return;

    let cancelled = false;
    let iv: any = null;

    const fetchOrder = async () => {
      try {
        const data = await fetchOrderByReferenceApi(ref);
        if (cancelled) return;

        const pay = String(data?.payment_status || "");
        const book = String(data?.booking_status || "");

        setPaymentStatus(pay);
        setBookingStatus(book);

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
                <dt className="text-sm font-medium text-gray-600">
                  Reference
                </dt>
                <dd className="text-lg font-semibold tracking-wide">
                  {ref}
                </dd>
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
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs text-amber-800">
                      Pending approval
                    </span>
                  )}
                  {bookingStatus === "approved" && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs text-emerald-800">
                      Approved
                    </span>
                  )}
                  {bookingStatus === "rejected" && (
                    <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-1 text-xs text-rose-800">
                      Not approved
                    </span>
                  )}
                  {polling && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      Updating
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {appointmentLabel ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">
                  Appointment
                </dt>
                <dd className="text-lg">{appointmentLabel}</dd>
              </div>
            ) : null}

            {email ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">
                  Receipt sent to
                </dt>
                <dd className="text-lg">{email}</dd>
              </div>
            ) : null}

            {slug ? (
              <div>
                <dt className="text-sm font-medium text-gray-600">
                  Service
                </dt>
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
          Keep this page open for your records, or check your email for
          the receipt and next steps.
        </p>
      </div>
    </>
  );
}
