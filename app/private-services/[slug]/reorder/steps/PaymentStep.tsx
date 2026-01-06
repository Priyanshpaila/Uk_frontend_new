"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import jsPDF from "jspdf";

import {
  ensureDraftOrder,
  getOrderIdForSlug,
  setOrderIdForSlug,
  setFinalizedOrderForSlug,
} from "../rebooking-order";

import {
  computeCartTotals,
  buildLastPaymentPayload,
  persistLastPayment,
  createRyftSessionApi,
  ensureRyftSdkLoaded,
  markOrderPaidApi,
  updateOrderApi,
  getOrderByIdApi,
  sendEmailApi,
  getStoredUserFromStorage,
  resolveUserIdFromStorage,
  fetchScheduleForServiceSlug,
  type CartItem,
  type CartTotals,
  type LastPaymentPayload,
  type LastPaymentItem,
  type OrderDto,
} from "@/lib/api";
import Lottie from "react-lottie";
import paymentAnimation from "@/assets/pay.json";

type PaymentStepProps = {
  serviceSlug?: string;
  goToSuccessStep?: () => void;
};

const formatMinorGBP = (minor?: number | null): string => {
  if (minor == null || Number.isNaN(minor)) return "£0.00";
  return `£${(minor / 100).toFixed(2)}`;
};

function readIdFromLocal(keys: string[]): string | null {
  if (typeof window === "undefined") return null;
  for (const k of keys) {
    try {
      const v =
        window.localStorage.getItem(k) ||
        window.sessionStorage.getItem(k) ||
        null;
      if (v && v !== "undefined" && v !== "null") return String(v);
    } catch {}
  }
  return null;
}

/* ---------------- Invoice helpers (unchanged from your file) ---------------- */

async function generateInvoicePdf(
  order: Partial<OrderDto> & { email?: string },
  payment: LastPaymentPayload
): Promise<File> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 16;

  const ref = order.reference || payment.ref;
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const customerName =
    `${order.first_name || ""} ${order.last_name || ""}`.trim() ||
    order.patient_name ||
    "Customer";
  const customerEmail = order.email || "";
  const serviceName =
    order.service_name ||
    (payment.slug || "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ||
    "Clinical service";

  const appointmentLabel =
    order.start_at ||
    payment.appointment_at ||
    (order.meta as any)?.appointment_start_at ||
    null;

  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 6, "F");

  const headerTopY = 36;

  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129);
  doc.text("Pharmacy Express", margin, headerTopY);

  let companyY = headerTopY + 13;
  doc.setFontSize(11);
  doc.setTextColor(75, 85, 99);
  doc.text("United Kingdom", margin, companyY);
  companyY += lineHeight;
  doc.text("Phone: +44 (0) 0000 000000", margin, companyY);
  companyY += lineHeight;
  doc.text("Email: support@safescript.co.uk", margin, companyY);
  companyY += lineHeight;
  doc.text("Website: safescript.co.uk", margin, companyY);

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text("Invoice", pageWidth - margin, headerTopY, { align: "right" });

  const bandY = 130;
  const bandH = 80;
  const colW = contentWidth / 3;

  doc.setFillColor(249, 250, 251);
  doc.rect(margin, bandY, contentWidth, bandH, "F");

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  let x1 = margin + 10;
  let y1 = bandY + 20;

  doc.setFontSize(10);
  doc.text("Bill to", x1, y1);
  y1 += lineHeight;
  doc.setFontSize(11);
  doc.text(customerName, x1, y1);
  y1 += lineHeight;
  if (customerEmail) {
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(customerEmail, x1, y1);
    y1 += lineHeight;
  }

  let x2 = margin + colW + 10;
  let y2 = bandY + 20;

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Ship to", x2, y2);
  y2 += lineHeight;
  doc.setFontSize(11);
  doc.text(customerName, x2, y2);
  y2 += lineHeight;
  if (customerEmail) {
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(customerEmail, x2, y2);
    y2 += lineHeight;
  }

  let x3 = margin + colW * 2 + 10;
  let y3 = bandY + 20;

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Details", x3, y3);
  y3 += lineHeight;

  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);
  doc.text(`Invoice # ${ref}`, x3, y3);
  y3 += lineHeight;
  doc.text(`Invoice date: ${dateLabel}`, x3, y3);
  y3 += lineHeight;
  doc.text(`Terms: Due on receipt`, x3, y3);
  y3 += lineHeight;
  doc.text(`Service: ${serviceName}`, x3, y3);

  let y = bandY + bandH + 40;
  const tableHeaderY = y;
  const tableHeight = 22;

  const descX = margin + 10;
  const qtyX = margin + contentWidth * 0.55;
  const unitX = margin + contentWidth * 0.7;
  const amountX = margin + contentWidth * 0.85;

  doc.setFillColor(243, 244, 246);
  doc.rect(margin, tableHeaderY - tableHeight + 6, contentWidth, tableHeight, "F");

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Description", descX, tableHeaderY);
  doc.text("Qty/Hrs", qtyX, tableHeaderY);
  doc.text("Rate", unitX, tableHeaderY);
  doc.text("Amount", amountX, tableHeaderY);

  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);

  const items: LastPaymentItem[] =
    (payment.items && payment.items.length
      ? payment.items
      : [
          {
            sku: "item",
            name: serviceName,
            variations: appointmentLabel
              ? `Appointment: ${new Date(appointmentLabel).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : null,
            qty: 1,
            unitMinor: payment.amountMinor,
            totalMinor: payment.amountMinor,
          } as LastPaymentItem,
        ]) || [];

  items.forEach((item) => {
    if (y > pageHeight - 160) {
      doc.addPage();
      y = margin;
    }

    const descriptionLines: string[] = [];
    const baseName = String(item.name || "Item");
    descriptionLines.push(baseName);
    if (item.variations) descriptionLines.push(String(item.variations));

    let tempY = y;
    descriptionLines.forEach((line) => {
      doc.text(line, descX, tempY, { maxWidth: qtyX - descX - 12 });
      tempY += lineHeight;
    });

    doc.text(String(item.qty || 1), qtyX, y);
    doc.text(formatMinorGBP(item.unitMinor), unitX, y);
    doc.text(formatMinorGBP(item.totalMinor), amountX, y);

    y = tempY + 6;
  });

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);

  const messageYStart = y + 24;
  const totalsYStart = y + 12;

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Customer message", margin, messageYStart);
  doc.setTextColor(75, 85, 99);
  doc.text(
    "Thank you for your purchase. Please retain this invoice for your records.",
    margin,
    messageYStart + lineHeight,
    { maxWidth: contentWidth * 0.5 }
  );

  const totalsX = margin + contentWidth * 0.55;

  let subtotalMinor = 0;
  items.forEach((i) => (subtotalMinor += Number(i.totalMinor || 0)));
  if (!subtotalMinor && payment.amountMinor) subtotalMinor = payment.amountMinor;

  const taxMinor = 0;
  const shippingMinor = 0;
  const totalMinor = subtotalMinor + taxMinor + shippingMinor;

  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99);

  let ty = totalsYStart + 10;
  const labelX = totalsX + contentWidth * 0.25;
  const valueX = pageWidth - margin;

  const drawRow = (label: string, value: string) => {
    doc.text(label, labelX, ty, { align: "right" });
    doc.text(value, valueX, ty, { align: "right" });
    ty += lineHeight;
  };

  drawRow("Subtotal", formatMinorGBP(subtotalMinor));
  drawRow("Sales tax", formatMinorGBP(taxMinor));
  drawRow("Shipping", formatMinorGBP(shippingMinor));

  ty += 6;
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Total", labelX, ty, { align: "right" });
  doc.setFontSize(12);
  doc.text(formatMinorGBP(totalMinor), valueX, ty, { align: "right" });

  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(
    "This invoice was generated by Pharmacy Express. For questions, please contact support@safescript.co.uk",
    margin,
    footerY,
    { maxWidth: contentWidth }
  );

  const blob = doc.output("blob");
  const fileName = `invoice-${ref}.pdf`;

  let file: File;
  file = new File([blob], fileName, { type: "application/pdf" });

  return file;
}

async function sendInvoiceEmailForOrder(
  orderId: string | null,
  payment: LastPaymentPayload,
  slug?: string
) {
  try {
    let order: Partial<OrderDto> & { email?: string } = {};
    if (orderId) {
      try {
        order = await getOrderByIdApi(orderId);
      } catch {}
    }

    if (!order.email) {
      const stored = getStoredUserFromStorage();
      if (stored?.email) {
        order.email = stored.email;
        order.first_name = order.first_name || stored.firstName;
        order.last_name = order.last_name || stored.lastName;
        order.patient_name =
          order.patient_name ||
          `${stored.firstName || ""} ${stored.lastName || ""}`.trim();
      }
    }

    const ref = order.reference || payment.ref;
    const email = order.email || "";
    if (!email) return;

    const serviceName =
      order.service_name ||
      (slug || payment.slug || "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const appointmentAt =
      order.start_at ||
      payment.appointment_at ||
      (order.meta as any)?.appointment_start_at ||
      null;

    const customerName =
      `${order.first_name || ""} ${order.last_name || ""}`.trim() ||
      order.patient_name ||
      "Customer";

    const loginUrl =
      process.env.NEXT_PUBLIC_LOGIN_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://safescript.co.uk";
    const supportEmail =
      process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@safescript.co.uk";

    const subject = `Payment successful - Ref ${ref}`;

    await sendEmailApi({
      to: email,
      subject,
      template: "paymentconfirmed",
      context: {
        name: customerName,
        email,
        reference: ref,
        totalAmount: formatMinorGBP(payment.amountMinor),
        serviceName,
        appointmentAt,
        loginUrl,
        supportEmail,
        year: new Date().getFullYear().toString(),
      },
    });
  } catch {}
}

export default function PaymentStep({ serviceSlug, goToSuccessStep }: PaymentStepProps) {
  const search = useSearchParams();
  const router = useRouter();
  const cartCtx: any = useCart();

  // support multiple cart APIs safely
  const items = cartCtx?.items ?? cartCtx?.state?.items ?? [];
  const clearCartFn =
    cartCtx?.clearCart || cartCtx?.clear || cartCtx?.resetCart || cartCtx?.reset;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("last_payment");
      window.localStorage.removeItem("orders_dirty");
      window.localStorage.removeItem("clearCart_cart");
    } catch {}
  }, []);

  const effectiveSlug = useMemo(() => {
    const fromProp = (serviceSlug || "").toString();
    const fromQuery = (search?.get("slug") || search?.get("service_slug") || "").toString();
    return fromProp || fromQuery;
  }, [serviceSlug, search]);

  const lines = (items || []) as CartItem[];
  const totals: CartTotals = useMemo(() => computeCartTotals(lines), [lines]);
  const totalDisplay = useMemo(() => formatMinorGBP(totals.totalMinor), [totals.totalMinor]);

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

  const [orderId, setOrderId] = useState<string | null>(null);
  console.log("PaymentStep: effectiveSlug=", effectiveSlug, " orderId=", orderId);
  const [orderInitError, setOrderInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveSlug) return;
    let cancelled = false;

    (async () => {
      try {
        setOrderInitError(null);

        const fromQuery = search?.get("order");
        if (fromQuery) {
          setOrderId(String(fromQuery));
          setOrderIdForSlug(effectiveSlug, String(fromQuery));
          return;
        }

        const existing = getOrderIdForSlug(effectiveSlug);
        if (existing) {
          setOrderId(String(existing));
          return;
        }

        const userId =
          readIdFromLocal(["user_id", "pe_user_id", "userId", "patient_id"]) ||
          resolveUserIdFromStorage();

        if (!userId) throw new Error("You need to be logged in to pay.");

        let serviceId =
          readIdFromLocal(["service_id", "pe_service_id", "serviceId"]) || null;

        let serviceName: string | undefined = undefined;

        if (!serviceId) {
          try {
            const sch: any = await fetchScheduleForServiceSlug(effectiveSlug);
            const fromSchedule =
              sch?.service_id ||
              sch?.serviceId ||
              (sch?.service && (sch.service._id || sch.service.id)) ||
              null;
            if (fromSchedule) serviceId = String(fromSchedule);
            if (sch?.name) serviceName = String(sch.name);
          } catch {}
        }

        if (!serviceId) {
          throw new Error("Missing service id; please start again from the service page.");
        }

        const ensured = await ensureDraftOrder({
          slug: effectiveSlug,
          userId: String(userId),
          serviceId: String(serviceId),
          serviceName,
          cartItems: lines,
          currency: "GBP",
          startAt: appointmentAtIso || null,
        });

        if (!cancelled) setOrderId(String(ensured));
      } catch (e: any) {
        if (!cancelled) setOrderInitError(e?.message || "Failed to prepare order for payment.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveSlug, search, appointmentAtIso, lines]);

  const [orderReference, setOrderReference] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    (async () => {
      try {
        const order = await getOrderByIdApi(orderId);
        if (!cancelled && (order as any)?.reference) setOrderReference(String((order as any).reference));
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const paymentRef = useMemo(() => orderReference || orderId || "ORDER", [orderReference, orderId]);
const paymentOdrId = useMemo(() => orderId ?? "default_order_id", [orderId]);



  const buildLastPayment = () =>
    buildLastPaymentPayload(paymentRef, totals, effectiveSlug, appointmentAtIso);

  // -----------------------
  // Test success
  // -----------------------
  const [testSubmitting, setTestSubmitting] = useState(false);

  const onTestSuccess = async () => {
    if (testSubmitting) return;

    const id = orderId || (effectiveSlug ? getOrderIdForSlug(effectiveSlug) : null);
    if (!id) {
      setOrderInitError("Order not ready yet. Please wait a moment and try again.");
      return;
    }

    setTestSubmitting(true);
    try {
      const payload = buildLastPayment();
      persistLastPayment(payload);

      // ✅ mark paid
      try {
        await updateOrderApi(id, { payment_status: "paid" } as any);
      } catch {}

      // ✅ CRITICAL: lock/finalize to prevent any new draft order auto-create
      try {
        if (effectiveSlug) setFinalizedOrderForSlug(effectiveSlug, id);
      } catch {}

      // ✅ CRITICAL: clear cart BEFORE success step cleanup runs
      try {
        if (typeof clearCartFn === "function") await clearCartFn();
      } catch {}

      await sendInvoiceEmailForOrder(id, payload, effectiveSlug);

      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("after_success_redirect", "home");
        } catch {}
      }

      if (goToSuccessStep) {
        goToSuccessStep();
        return;
      }

      if (typeof window !== "undefined") {
        const base = `/private-services/${effectiveSlug}/book`;
        const u = new URL(base, window.location.origin);
        u.searchParams.set("step", "success");
        u.searchParams.set("order", id);
        u.searchParams.set("slug", effectiveSlug);
        if (appointmentAtIso) u.searchParams.set("appointment_at", appointmentAtIso);
        router.push(u.pathname + u.search + u.hash);
      }
    } finally {
      setTestSubmitting(false);
    }
  };

  // =========================
  // Embedded Ryft
  // =========================
  const [error, setError] = useState<string | null>(null);
  const [initialising, setInitialising] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [cardValid, setCardValid] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [showPay, setShowPay] = useState(false);

  const revealPay = () => {
    setShowPay(true);
    setTimeout(() => {
      try {
        const form = document.getElementById("ryft-pay-form");
        form?.scrollIntoView({ behavior: "smooth", block: "start" });
        const btn = document.getElementById("ryft-pay-btn") as HTMLButtonElement | null;
        btn?.focus();
      } catch {}
    }, 0);
  };

  useEffect(() => {
    let cancelled = false;

    async function setupRyft() {
      try {
        setInitialising(true);
        setError(null);
        const totalAmountInMinorUnits = totals.totalMinor;

        const secret = await createRyftSessionApi({
          amountMinor: totalAmountInMinorUnits,
          currency: process.env.NEXT_PUBLIC_CONSULTATION_CURRENCY || "GBP",
          order_id: paymentOdrId,
          description: "Clinic payment",
        });

        if (cancelled) return;
        setClientSecret(secret);

        await ensureRyftSdkLoaded();
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
            billingAddress: { display: "full" },
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

    if (totals.totalMinor > 0 && showPay) setupRyft();

    return () => {
      cancelled = true;
    };
  }, [totals.totalMinor, showPay, paymentRef]);

if (!totals.lines.length) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/80 p-8 text-center shadow-lg shadow-slate-200/70">
      <h2 className="text-2xl font-semibold text-slate-900">Payment</h2>

      {/* Lottie Animation for empty basket */}
      <div className="my-8">
        <Lottie
          options={{
            animationData: paymentAnimation,
            loop: true,
            autoplay: true, // Starts the animation immediately
          }}
          height={200}
          width={200}
        />
      </div>

      {/* {appointmentAtPretty ? (
        <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-900">
          Appointment {appointmentAtPretty}
        </div>
      ) : null} */}

      {/* <p className="mt-4 text-sm text-slate-500">Your basket is currently empty.</p> */}

      {/* <div className="mt-6 flex justify-center">
        <Link
          href={`/private-services/${effectiveSlug}/book?step=treatments`}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Back to treatments
        </Link>
      </div> */}
    </div>
  );
}

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
      <Script src="https://embedded.ryftpay.com/v2/ryft.min.js" strategy="afterInteractive" />

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Payment</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Securely complete your booking.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            Reference: {paymentRef}
          </span>
          <span className="text-xl font-semibold text-slate-900">{totalDisplay}</span>
        </div>
      </header>

      {orderInitError ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
          {orderInitError}
        </div>
      ) : null}

      {appointmentAtPretty ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs sm:text-sm text-emerald-900">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium">Appointment:</span>
          <span>{appointmentAtPretty}</span>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Order summary</h3>
            <span className="text-xs text-slate-500">
              {lines.length} item{lines.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {totals.lines.map((it) => (
              <div
                key={`${it.sku}-${it.label ?? ""}`}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{it.name}</div>
                  {it.label ? <div className="truncate text-xs text-slate-600">{it.label}</div> : null}
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                    Qty {it.qty}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatMinorGBP(it.totalMinor ?? 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900">Payment</h3>
          <p className="mt-1 text-xs text-slate-500">
            Card details are processed securely by Ryft. We never store your full card number.
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="text-sm text-slate-600">Total to pay</span>
            <span className="text-lg font-semibold text-slate-900">{totalDisplay}</span>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={revealPay}
              disabled={initialising || !orderId}
              className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-sm transition ${
                initialising || !orderId ? "cursor-not-allowed bg-slate-400" : "bg-slate-900 hover:bg-black"
              }`}
            >
              {initialising ? "Preparing payment…" : "Pay securely"}
            </button>

            <button
              type="button"
              onClick={onTestSuccess}
              disabled={testSubmitting || !orderId}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {testSubmitting ? "Payment Successful" : "Test success"}
            </button>

            <Link
              href={`/private-services/${effectiveSlug}/book?step=treatments`}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Back
            </Link>
          </div>

          {showPay && (
            <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
              {error && (
                <div className="rounded-xl bg-rose-50 p-3 text-xs sm:text-sm text-rose-700">
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
                  if (!orderId) {
                    setError("Order not ready yet");
                    return;
                  }

                  try {
                    const paymentSession = await Ryft.attemptPayment({ clientSecret });

                    if (paymentSession?.status === "Approved" || paymentSession?.status === "Captured") {
                      const payload = buildLastPayment();
                      persistLastPayment(payload);

                      try {
                        await markOrderPaidApi(orderId, {
                          payment_status: "paid",
                          payment_reference:
                            paymentSession?.id || paymentSession?.reference || payload.ref,
                          amountMinor: payload.amountMinor,
                          provider: "ryft",
                          raw: paymentSession,
                        } as any);
                      } catch {}

                      // ✅ finalize + clear cart BEFORE moving to success
                      try {
                        if (effectiveSlug) setFinalizedOrderForSlug(effectiveSlug, orderId);
                      } catch {}

                      try {
                        if (typeof clearCartFn === "function") await clearCartFn();
                      } catch {}

                      await sendInvoiceEmailForOrder(orderId, payload, effectiveSlug);

                      if (typeof window !== "undefined") {
                        try {
                          window.localStorage.setItem("after_success_redirect", "home");
                        } catch {}
                      }

                      if (goToSuccessStep) {
                        goToSuccessStep();
                        return;
                      }

                      if (typeof window !== "undefined") {
                        const base = `/private-services/${effectiveSlug}/book`;
                        const u = new URL(base, window.location.origin);
                        u.searchParams.set("step", "success");
                        u.searchParams.set("order", orderId || payload.ref);
                        u.searchParams.set("slug", effectiveSlug);
                        if (appointmentAtIso) u.searchParams.set("appointment_at", appointmentAtIso);
                        window.location.href = u.pathname + u.search + u.hash;
                      }
                      return;
                    }

                    if (paymentSession?.lastError) {
                      const msg = (window as any)?.Ryft?.getUserFacingErrorMessage?.(paymentSession.lastError);
                      setError(msg || "Payment declined");
                    } else {
                      setError("Payment was not approved");
                    }
                  } catch (err: any) {
                    setError(err?.message || "Payment failed");
                  }
                }}
              >
                <button
                  id="ryft-pay-btn"
                  type="submit"
                  disabled={!sdkReady || !clientSecret || !cardValid || initialising || !orderId}
                  className="w-full justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {initialising ? "Loading payment…" : `Pay ${totalDisplay}`}
                </button>

                <div id="ryft-pay-error" className="text-xs text-rose-600">
                  {error}
                </div>

                <p className="text-[11px] text-slate-500">
                  Apple Pay / Google Pay buttons will appear automatically on compatible devices.
                </p>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
