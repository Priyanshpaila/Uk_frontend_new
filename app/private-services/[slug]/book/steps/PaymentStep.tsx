// app/private-services/[slug]/book/steps/PaymentStep.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";

import {
  makeRefFromSlug,
  computeCartTotals,
  buildLastPaymentPayload,
  persistLastPayment,
  createRyftSessionApi,
  ensureRyftSdkLoaded,
  type CartItem,
  type CartTotals,
} from "@/lib/api"; // or "@/lib/api" if you merged helpers there

type PaymentStepProps = {
  serviceSlug?: string;
};

export default function PaymentStep({ serviceSlug }: PaymentStepProps) {
  const search = useSearchParams();

  // NOTE: in your cart-context you almost certainly have { items, clearCart }
  // NOT { clearCartCart }, so we use `clearCart` here.
  const { items, clearCart } = useCart();

  // ---- clearCart any stale payment flags on mount ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      // Old stale state from previous checkouts
      window.localStorage.removeItem("last_payment");
      window.localStorage.removeItem("orders_dirty");
      window.localStorage.removeItem("clearCart_cart");
      // Optional: clearCart any "cart clearCarted" markers to allow new flow
      // window.sessionStorage.removeItem("cart-clearCarted:generic");
    } catch {
      // ignore
    }
  }, []);

  // ---- Effective slug (from parent prop or ?slug=...) ----
  const effectiveSlug = useMemo(() => {
    const fromProp = (serviceSlug || "").toString();
    const fromQuery = (search?.get("slug") || "").toString();
    return fromProp || fromQuery;
  }, [serviceSlug, search]);

  // ---- Appointment ----
  const appointmentAtIso = search?.get("appointment_at") || null;
  const appointmentAtPretty = useMemo(() => {
    if (!appointmentAtIso) return null;
    const d = new Date(appointmentAtIso);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [appointmentAtIso]);

  // ---- Cart totals ----
  const lines = (items || []) as CartItem[];
  const totals: CartTotals = useMemo(
    () => computeCartTotals(lines),
    [lines]
  );

  const fmt = (minor: number) => `£${(minor / 100).toFixed(2)}`;
  const totalDisplay = useMemo(
    () => fmt(totals.totalMinor),
    [totals.totalMinor]
  );

  // ---- Reference code (stable for this render) ----
  const refCode = useMemo(
    () => makeRefFromSlug(effectiveSlug),
    [effectiveSlug]
  );

  // ---- last_payment payload builder ----
  const buildLastPayment = () =>
    buildLastPaymentPayload(
      refCode,
      totals,
      effectiveSlug,
      appointmentAtIso
    );

  // -----------------------
  // Test success (no real charge)
  // -----------------------
  const [testSubmitting, setTestSubmitting] = useState(false);

  const onTestSuccess = () => {
    if (testSubmitting) return; // prevent double-click locally
    setTestSubmitting(true);

    const payload = buildLastPayment();
    persistLastPayment(payload);

    // clearCart in-memory cart
    try {
      clearCart?.();
    } catch {
      // ignore
    }

    const base = `/private-services/${effectiveSlug}/book`;
    const u = new URL(base, window.location.origin);
    u.searchParams.set("step", "success");
    u.searchParams.set("order", payload.ref);
    u.searchParams.set("slug", effectiveSlug);
    if (appointmentAtIso) {
      u.searchParams.set("appointment_at", appointmentAtIso);
    }

    window.location.href = u.pathname + u.search + u.hash;
  };

  // =========================
  // Embedded Ryft (Apple/Google Pay + Cards)
  // =========================
  const [error, setError] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardValid, setCardValid] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [showPay, setShowPay] = useState(false);

  // Reveal payment form + scroll
  const revealPay = () => {
    setShowPay(true);
    setTimeout(() => {
      try {
        const form = document.getElementById("ryft-pay-form");
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        const btn = document.getElementById(
          "ryft-pay-btn"
        ) as HTMLButtonElement | null;
        btn?.focus();
      } catch {
        // ignore
      }
    }, 0);
  };

  // ---- Setup Ryft when user reveals Pay and there is something to pay ----
  useEffect(() => {
    let cancelled = false;

    async function setupRyft() {
      try {
        setInitialising(true);
        setError(null);

        const secret = await createRyftSessionApi({
          amountMinor: totals.totalMinor,
          currency:
            process.env.NEXT_PUBLIC_CONSULTATION_CURRENCY || "GBP",
          reference: refCode,
          description: "Clinic payment",
        });

        if (cancelled) return;
        setClientSecret(secret);

        await ensureRyftSdkLoaded();
        if (cancelled) return;

        const Ryft: any = (window as any).Ryft;
        const publicKey = process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY;
        if (!publicKey) {
          throw new Error("Missing NEXT_PUBLIC_RYFT_PUBLIC_KEY");
        }

        Ryft.init({
          publicKey,
          clientSecret: secret,
          applePay: {
            merchantName: "Safescript Pharmacy",
            merchantCountryCode: "GB",
          },
          googlePay: {
            merchantIdentifier: "merchant_safescript",
            merchantName: "Safescript Pharmacy",
            merchantCountryCode: "GB",
          },
          fieldCollection: {
            billingAddress: {
              display: "full",
            },
          },
          style: {
            borderRadius: 8,
            backgroundColor: "#ffffff",
            borderColor: "#e5e7eb",
            padding: 12,
            color: "#111827",
            focusColor: "#111827",
            bodyColor: "#ffffff",
          },
        });

        Ryft.addEventHandler(
          "cardValidationChanged",
          (e: any) => {
            setCardValid(Boolean(e?.isValid));
          }
        );

        setSdkReady(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to initialise payments");
        }
      } finally {
        if (!cancelled) {
          setInitialising(false);
        }
      }
    }

    if (totals.totalMinor > 0 && showPay) {
      setupRyft();
    }

    return () => {
      cancelled = true;
    };
  }, [totals.totalMinor, showPay, refCode]);

  // ---- Empty cart guard ----
  if (!totals.lines.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Payment</h2>
        {appointmentAtPretty ? (
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Appointment {appointmentAtPretty}
          </div>
        ) : null}
        <p className="mt-2 text-gray-600">Your basket is empty.</p>
        <div className="mt-6">
          <Link
            href={`/private-services/${effectiveSlug}/book?step=treatments`}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-5 py-2.5 text-gray-900 hover:bg-gray-50"
          >
            Back to treatments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
      <Script
        src="https://embedded.ryftpay.com/v2/ryft.min.js"
        strategy="afterInteractive"
      />

      <h2 className="text-2xl font-semibold">Payment</h2>

      {appointmentAtPretty ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Appointment {appointmentAtPretty}
        </div>
      ) : null}

      {/* Basket summary */}
      <div className="mt-6 space-y-3">
        {totals.lines.map((it) => (
          <div
            key={`${it.sku}-${it.label ?? ""}`}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate font-medium text-gray-900">
                {it.name}
              </div>
              {it.label ? (
                <div className="truncate text-sm text-gray-600">
                  {it.label}
                </div>
              ) : null}
              <div className="text-xs text-gray-500">
                Qty {it.qty}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">
                {fmt(it.totalMinor ?? 0)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <hr className="mt-6 border-gray-200" />
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-gray-700">
            Total to pay
          </span>
          <span className="text-xl font-semibold">
            {totalDisplay}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row">
        <button
          type="button"
          onClick={revealPay}
          disabled={initialising}
          className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-white ${
            initialising
              ? "cursor-wait bg-gray-400"
              : "bg-black hover:bg-zinc-900"
          }`}
        >
          Pay
        </button>

        <button
          type="button"
          onClick={onTestSuccess}
          disabled={testSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-2.5 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {testSubmitting ? "Redirecting…" : "Test success"}
        </button>

        <Link
          href={`/private-services/${effectiveSlug}/book?step=treatments`}
          className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-2.5 text-gray-900 hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      {/* Embedded Ryft form */}
      {showPay && (
        <div className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <form
            id="ryft-pay-form"
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const Ryft: any = (window as any).Ryft;
              if (!Ryft || !clientSecret) {
                setError("Payments not ready yet");
                return;
              }

              Ryft.attemptPayment({ clientSecret })
                .then((paymentSession: any) => {
                  if (
                    paymentSession?.status === "Approved" ||
                    paymentSession?.status === "Captured"
                  ) {
                    const payload = buildLastPayment();
                    persistLastPayment(payload);

                    try {
                      clearCart?.();
                    } catch {
                      // ignore
                    }

                    const base = `/private-services/${effectiveSlug}/book`;
                    const u = new URL(
                      base,
                      window.location.origin
                    );
                    u.searchParams.set("step", "success");
                    u.searchParams.set("order", payload.ref);
                    u.searchParams.set("slug", effectiveSlug);
                    if (appointmentAtIso) {
                      u.searchParams.set(
                        "appointment_at",
                        appointmentAtIso
                      );
                    }
                    window.location.href =
                      u.pathname + u.search + u.hash;
                    return;
                  }

                  if (paymentSession?.lastError) {
                    const msg =
                      (window as any)?.Ryft?.getUserFacingErrorMessage?.(
                        paymentSession.lastError
                      );
                    setError(msg || "Payment declined");
                  }
                })
                .catch((err: any) =>
                  setError(err?.message || "Payment failed")
                );
            }}
          >
            <button
              id="ryft-pay-btn"
              type="submit"
              disabled={
                !sdkReady || !clientSecret || !cardValid || initialising
              }
              className="w-full justify-center rounded-full bg-black px-4 py-3 text-white disabled:opacity-50"
            >
              {initialising
                ? "Loading payment…"
                : `Pay ${totalDisplay}`}
            </button>
            <div
              id="ryft-pay-error"
              className="text-sm text-rose-600"
            >
              {error}
            </div>
            <p className="text-xs text-gray-500">
              Apple Pay / Google Pay buttons will appear automatically
              on compatible devices.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
