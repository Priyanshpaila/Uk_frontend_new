"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/components/cart-context";

type LastPaymentItem = {
  sku: string
  name: string
  variations: string | null
  qty: number
  unitMinor: number
  totalMinor: number
};

type CartItem = {
  sku: string;
  name: string;
  qty: number;
  price?: number;       // in pounds (optional)
  priceMinor?: number;  // unit price in minor units (pence)
  unitMinor?: number;   // alias of priceMinor
  totalMinor?: number;  // line total in minor
  label?: string;       // variation label
};

export default function PaymentStep({ serviceSlug }: { serviceSlug?: string }) {
  const { items, clear } = useCart();
  const search = useSearchParams();

  const effectiveSlug = useMemo(() => {
    const fromProp = (serviceSlug || '').toString();
    const fromParam = (search?.get('slug') || '').toString();
    const fromPath = typeof window !== 'undefined' ? (window.location.pathname.split('/')[2] || '') : '';
    return fromProp || fromParam || fromPath || '';
  }, [serviceSlug, search]);

  const makeRefFromSlug = (slug: string) => {
    // Normalise and split the slug into words
    const cleaned = (slug || '').replace(/[^a-zA-Z]+/g, ' ').trim();
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    // Prefer first letters of first two words e.g. "travel clinic" -> "TC"
    let letters = tokens.slice(0, 2).map(s => s[0].toUpperCase()).join('');

    // If only one word, use its first two characters e.g. "weightloss" -> "WL"
    if (letters.length < 2 && tokens[0]) {
      letters = tokens[0].slice(0, 2).toUpperCase();
    }

    // Final safety fallback
    if (letters.length < 2) letters = 'AA';

    // 6 digits from timestamp
    const num = String(Date.now()).slice(-6);

    // Format examples: PTC850719 for "travel-clinic", PWL123456 for "weight-loss"
    return `P${letters}${num}`;
  };

  const refCode = useMemo(() => makeRefFromSlug(effectiveSlug), [effectiveSlug]);

  // ---- Appointment chip (from CalendarStep) ----
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

  // ---- Totals from cart ----
  const lines = (items || []) as CartItem[];

  const computed = useMemo(() => {
    let subtotalMinor = 0;

    const normalised = lines.map((it) => {
      const unit = Number.isFinite(it.unitMinor)
        ? (it.unitMinor as number)
        : Number.isFinite(it.priceMinor)
        ? (it.priceMinor as number)
        : Math.round(((it.price ?? 0) as number) * 100);

      const total =
        Number.isFinite(it.totalMinor) && (it.totalMinor as number) > 0
          ? (it.totalMinor as number)
          : unit * (it.qty || 1);

      subtotalMinor += total;

      return {
        ...it,
        unitMinor: unit,
        totalMinor: total,
      };
    });

    const feesMinor = 0;
    const totalMinor = subtotalMinor + feesMinor;

    return {
      lines: normalised,
      subtotalMinor,
      feesMinor,
      totalMinor,
    };
  }, [lines]);

  const fmt = (minor: number) => `£${(minor / 100).toFixed(2)}`;

  // ---- Builder for detailed last_payment ----
  const buildLastPayment = () => {
    const mapped: LastPaymentItem[] = (computed.lines || []).map((it: any) => ({
      sku: String(it.sku || "item"),
      name: String(it.name || "Item"),
      variations: (it.label || null) as string | null,
      qty: Math.max(1, Number(it.qty) || 1),
      unitMinor: Number(it.unitMinor || 0) || 0,
      totalMinor: Number(it.totalMinor || 0) || 0,
    }));

    let sessionId: string | undefined = undefined;
    try {
      const s1 = localStorage.getItem("consultation_session_id") || "";
      const s2 = sessionStorage.getItem("consultation_session_id") || "";
      sessionId = (s1 || s2 || "").trim() || undefined;
    } catch {}

    return {
      ref: refCode,
      amountMinor: computed.totalMinor,
      ts: Date.now(),
      slug: effectiveSlug || "",
      appointment_at: appointmentAtIso || null,
      sessionId,
      items: mapped,
    } as const;
  };
  // ---- Local test success (dev) ----
  const onTestSuccess = () => {
    const payload = buildLastPayment();
    try {
      localStorage.setItem("last_payment", JSON.stringify(payload));
      localStorage.setItem("orders_dirty", "1");
    } catch {}

    try { clear?.(); } catch {}
    try { localStorage.setItem("clear_cart", "1"); } catch {}

    const base = `/private-services/${effectiveSlug}/book`;
    const u = new URL(base, window.location.origin);
    u.searchParams.set("step", "success");
    u.searchParams.set("order", payload.ref);
    u.searchParams.set("slug", effectiveSlug);
    if (appointmentAtIso) u.searchParams.set("appointment_at", appointmentAtIso);
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

  // Smooth scroll helper for the top "Pay" button
  const revealPay = () => {
    // Reveal the embedded payment form on demand
    setShowPay(true);
    // Scroll after it's been mounted
    setTimeout(() => {
      try {
        const form = document.getElementById("ryft-pay-form");
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        const btn = document.getElementById("ryft-pay-btn") as HTMLButtonElement | null;
        btn?.focus();
      } catch {
        /* no-op */
      }
    }, 0);
  };

  const totalDisplay = useMemo(() => fmt(computed.totalMinor), [computed.totalMinor]);

  useEffect(() => {
    let cancelled = false;

    async function setupRyft() {
      try {
        setInitialising(true);
        setError(null);

        const payload = {
          amount: computed.totalMinor,
          currency: process.env.NEXT_PUBLIC_CONSULTATION_CURRENCY || "GBP",
          description: "Clinic payment",
          reference: refCode,
          // Optional: include metadata / email if you want
        };

        // Ask our Next.js API to create a Payment Session (server-side with Ryft SECRET)
        // Implement /app/api/pay/ryft/session/route.ts to return { clientSecret }.
        const res = await fetch("/api/pay/ryft/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });

        const text = await res.text();
        let data: any;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }

        const friendly = (s: string) => {
          if (!s) return "";
          const trimmed = s.trim();
          if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
            return "Could not create payment session (404). Is /api/pay/ryft/session implemented and reachable?";
          }
          return trimmed.slice(0, 400);
        };

        if (!res.ok) {
          const msg = friendly(data?.detail || data?.message || text || "Could not create payment session");
          throw new Error(msg);
        }

        const secret = data?.clientSecret;
        if (!secret) throw new Error("Server did not return clientSecret");

        if (cancelled) return;
        setClientSecret(secret);

        // Wait for SDK to be present on window
        const ensureRyft = () =>
          new Promise<void>((resolve, reject) => {
            let tries = 0;
            const timer = setInterval(() => {
              tries++;
              if (typeof (window as any).Ryft !== "undefined") {
                clearInterval(timer);
                resolve();
              } else if (tries > 50) {
                clearInterval(timer);
                reject(new Error("Ryft SDK not loaded"));
              }
            }, 100);
          });

        await ensureRyft();
        if (cancelled) return;

        const Ryft: any = (window as any).Ryft;
        const publicKey = process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY;
        if (!publicKey) throw new Error("Missing NEXT_PUBLIC_RYFT_PUBLIC_KEY");

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

        Ryft.addEventHandler("cardValidationChanged", (e: any) => {
          setCardValid(Boolean(e?.isValid));
        });

        setSdkReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to initialise payments");
      } finally {
        if (!cancelled) setInitialising(false);
      }
    }

    // Only try to set up if there is something to pay and user has revealed the pay form
    if (computed.totalMinor > 0 && showPay) {
      setupRyft();
    }

    return () => {
      cancelled = true;
    };
  }, [computed.totalMinor, showPay]);

  if (!computed.lines.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold">Payment</h2>
        {appointmentAtPretty ? (
          <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
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
      <Script src="https://embedded.ryftpay.com/v2/ryft.min.js" strategy="afterInteractive" />

      <h2 className="text-2xl font-semibold">Payment</h2>

      {appointmentAtPretty ? (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
          Appointment {appointmentAtPretty}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {computed.lines.map((it) => (
          <div
            key={it.sku}
            className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">{it.name}</div>
              {it.label ? (
                <div className="text-sm text-gray-600 truncate">{it.label}</div>
              ) : null}
              <div className="text-xs text-gray-500">Qty {it.qty}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{fmt(it.totalMinor ?? 0)}</div>
            </div>
          </div>
        ))}
      </div>

      <hr className="mt-6 border-gray-200" />
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium text-gray-700">Total to pay</span>
          <span className="text-xl font-semibold">{totalDisplay}</span>
        </div>
      </div>

      {/* Action pills */}
      <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
        <button
          type="button"
          onClick={revealPay}
          disabled={initialising}
          className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-white ${initialising ? "bg-gray-400 cursor-wait" : "bg-black hover:bg-zinc-900"}`}
          aria-label="Open payment form"
          title="Open payment form"
        >
          Pay
        </button>

        <button
          onClick={onTestSuccess}
          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-2.5 text-white hover:bg-emerald-700"
        >
          Test success
        </button>

        <Link
          href={`/private-services/${effectiveSlug}/book?step=treatments`}
          className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-2.5 text-gray-900 hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      {/* Embedded Ryft form (appears below) */}
      {showPay && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          {error && <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}

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
                  if (paymentSession?.status === "Approved" || paymentSession?.status === "Captured") {
                    const payload = buildLastPayment();
                    try {
                      localStorage.setItem("last_payment", JSON.stringify(payload));
                      localStorage.setItem("orders_dirty", "1");
                    } catch {}

                    try { clear?.(); } catch {}
                    try { localStorage.setItem("clear_cart", "1"); } catch {}

                    const base = `/private-services/${effectiveSlug}/book`;
                    const u = new URL(base, window.location.origin);
                    u.searchParams.set("step", "success");
                    u.searchParams.set("order", payload.ref);
                    u.searchParams.set("slug", effectiveSlug);
                    if (appointmentAtIso) u.searchParams.set("appointment_at", appointmentAtIso);
                    window.location.href = u.pathname + u.search + u.hash;
                    return;
                  }
                  if (paymentSession?.lastError) {
                    const msg = (window as any)?.Ryft?.getUserFacingErrorMessage?.(paymentSession.lastError);
                    setError(msg || "Payment declined");
                  }
                })
                .catch((err: any) => setError(err?.message || "Payment failed"));
            }}
          >
            <button
              id="ryft-pay-btn"
              type="submit"
              disabled={!sdkReady || !clientSecret || !cardValid || initialising}
              className="w-full px-4 py-3 rounded-full bg-black text-white disabled:opacity-50 justify-center"
            >
              {initialising ? "Loading payment…" : `Pay ${totalDisplay}`}
            </button>
            <div id="ryft-pay-error" className="text-sm text-rose-600">{error}</div>
            <p className="text-xs text-gray-500">
              Apple Pay / Google Pay buttons will appear automatically on compatible devices.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}