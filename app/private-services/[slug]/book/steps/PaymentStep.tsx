"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import jsPDF from "jspdf";

import {
  makeRefFromSlug,
  computeCartTotals,
  buildLastPaymentPayload,
  persistLastPayment,
  createRyftSessionApi,
  ensureRyftSdkLoaded,
  markOrderPaidApi,
  updateOrderApi, // ✅ used for test success
  getOrderByIdApi,
  sendEmailApi,
  getStoredUserFromStorage, // 👈 fallback source for user details
  type CartItem,
  type CartTotals,
  type LastPaymentPayload,
  type LastPaymentItem,
  type OrderDto,
} from "@/lib/api";

type PaymentStepProps = {
  serviceSlug?: string;
};

/* ------------------------------------------------------------------ */
/*                   Shared helpers (money + invoice)                 */
/* ------------------------------------------------------------------ */

const formatMinorGBP = (minor?: number | null): string => {
  if (minor == null || Number.isNaN(minor)) return "£0.00";
  return `£${(minor / 100).toFixed(2)}`;
};

// Build an invoice PDF for a given order + payment payload
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

  /* ------------------------ Top bar & header ------------------------ */

  // Thin emerald accent line at very top
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 6, "F");

  const headerTopY = 36;

  // Brand name (coloured)
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text("Pharmacy Express", margin, headerTopY);

  // Company meta under brand
  let companyY = headerTopY + 13;
  doc.setFontSize(11);
  doc.setTextColor(75, 85, 99); // gray-600
  doc.text("United Kingdom", margin, companyY);
  companyY += lineHeight;
  doc.text("Phone: +44 (0) 0000 000000", margin, companyY);
  companyY += lineHeight;
  doc.text("Email: support@safescript.co.uk", margin, companyY);
  companyY += lineHeight;
  doc.text("Website: safescript.co.uk", margin, companyY);

  // "Invoice" title on the right
  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("Invoice", pageWidth - margin, headerTopY, { align: "right" });

  /* ------------------------ Bill to / Details band ------------------- */

  const bandY = 130;
  const bandH = 80;
  const colW = contentWidth / 3;

  // Light background band
  doc.setFillColor(249, 250, 251); // gray-50
  doc.rect(margin, bandY, contentWidth, bandH, "F");

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);

  // Column 1: Bill to
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

  // Column 2: Ship to (same as Bill to)
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

  // Column 3: Invoice details
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

  /* ------------------------ Items table ------------------------------ */

  let y = bandY + bandH + 40;
  const tableHeaderY = y;
  const tableHeight = 22;

  // Column positions
  const descX = margin + 10;
  const qtyX = margin + contentWidth * 0.55;
  const unitX = margin + contentWidth * 0.7;
  const amountX = margin + contentWidth * 0.85;

  // Header background
  doc.setFillColor(243, 244, 246); // gray-100
  doc.rect(
    margin,
    tableHeaderY - tableHeight + 6,
    contentWidth,
    tableHeight,
    "F"
  );

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Description", descX, tableHeaderY);
  doc.text("Qty/Hrs", qtyX, tableHeaderY);
  doc.text("Rate", unitX, tableHeaderY);
  doc.text("Amount", amountX, tableHeaderY);

  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55); // gray-800

  // Items (fallback to single line if empty)
  const items: LastPaymentItem[] =
    (payment.items && payment.items.length
      ? payment.items
      : [
          {
            sku: "item",
            name: serviceName,
            variations: appointmentLabel
              ? `Appointment: ${new Date(appointmentLabel).toLocaleString(
                  "en-GB",
                  {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}`
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
    if (item.variations) {
      descriptionLines.push(String(item.variations));
    }

    let tempY = y;
    descriptionLines.forEach((line) => {
      doc.text(line, descX, tempY, {
        maxWidth: qtyX - descX - 12,
      });
      tempY += lineHeight;
    });

    doc.text(String(item.qty || 1), qtyX, y);
    doc.text(formatMinorGBP(item.unitMinor), unitX, y);
    doc.text(formatMinorGBP(item.totalMinor), amountX, y);

    y = tempY + 6;
  });

  // Line under table
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.line(margin, y, pageWidth - margin, y);

  /* ------------------------ Customer message & totals ---------------- */

  const messageYStart = y + 24;
  const totalsYStart = y + 12;

  // Left: message
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

  // Right: totals
  const totalsX = margin + contentWidth * 0.55;

  let subtotalMinor = 0;
  items.forEach((i) => {
    subtotalMinor += Number(i.totalMinor || 0);
  });
  if (!subtotalMinor && payment.amountMinor) {
    subtotalMinor = payment.amountMinor;
  }

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

  /* ------------------------ Footer ---------------------------------- */

  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text(
    "This invoice was generated by Pharmacy Express. For questions, please contact support@safescript.co.uk",
    margin,
    footerY,
    { maxWidth: contentWidth }
  );

  /* ------------------------ Export as File --------------------------- */

  const blob = doc.output("blob");
  const fileName = `invoice-${ref}.pdf`;

  let file: File;
  try {
    file = new File([blob], fileName, { type: "application/pdf" });
  } catch {
    throw new Error("File constructor not available for PDF attachment");
  }

  return file;
}

// Fetch order + send email with invoice PDF attached
async function sendInvoiceEmailForOrder(
  orderId: string | null,
  payment: LastPaymentPayload,
  slug?: string
) {
  try {
    console.log("▶ sendInvoiceEmailForOrder start", { orderId, payment });

    // 1) Try to get full order from backend (preferred)
    let order: Partial<OrderDto> & { email?: string } = {};
    if (orderId) {
      try {
        order = await getOrderByIdApi(orderId);
      } catch (err) {
        console.error(
          "Failed to fetch order by id, will use fallback user",
          err
        );
      }
    }

    // 2) Fallback to stored user if we still don't have email
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

    if (!email) {
      console.warn(
        "No email found on order or stored user; skipping invoice email.",
        { order, payment }
      );
      return;
    }

    // Friendly service name fallback from slug if needed
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

    // 3) Try to generate PDF (may fail – we still want to send email)
    let invoicePdf: File | null = null;
    try {
      invoicePdf = await generateInvoicePdf(order, payment);
    } catch (err) {
      console.error(
        "Failed to generate invoice PDF, will send email without attachment",
        err
      );
    }

    const baseContext = {
      name: customerName,
      email,
      reference: ref,
      totalAmount: formatMinorGBP(payment.amountMinor),
      serviceName,
      appointmentAt,
      loginUrl,
      supportEmail,
      year: new Date().getFullYear().toString(),
    };

    // 4) First attempt: with attachment (if we have one)
    try {
      console.log("▶ Sending email (with attachment?)", {
        to: email,
        subject,
        hasAttachment: !!invoicePdf,
      });

      await sendEmailApi({
        to: email,
        subject,
        template: "paymentconfirmed", // 🔒 hard-coded template
        context: baseContext,
        attachments: invoicePdf ? [invoicePdf] : undefined,
      });

      console.log("✅ Invoice email sent successfully");
      return;
    } catch (err) {
      console.error(
        "Failed to send email with attachment, will retry without attachment",
        err
      );
    }

    // 5) Fallback attempt: send again without attachment
    try {
      await sendEmailApi({
        to: email,
        subject,
        template: "paymentconfirmed",
        context: baseContext,
        // no attachments
      });
      console.log(
        "✅ Invoice email sent successfully (no attachment fallback)"
      );
    } catch (err2) {
      console.error(
        "❌ Failed to send invoice email even without attachment",
        err2
      );
    }
  } catch (err) {
    console.error("Failed in sendInvoiceEmailForOrder wrapper:", err);
  }
}

/* ------------------------------------------------------------------ */
/*                          Component body                            */
/* ------------------------------------------------------------------ */

export default function PaymentStep({ serviceSlug }: PaymentStepProps) {
  const search = useSearchParams();
  const router = useRouter();

  const { items, clearCart } = useCart();

  // ---- clear any stale payment flags on mount ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("last_payment");
      window.localStorage.removeItem("orders_dirty");
      window.localStorage.removeItem("clearCart_cart");
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

  // ---- Order + appointment ----
  const orderId = useMemo(() => {
    const fromQuery = search?.get("order");
    if (fromQuery) return fromQuery;
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem("order_id");
    } catch {
      return null;
    }
  }, [search]);

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
  const totals: CartTotals = useMemo(() => computeCartTotals(lines), [lines]);

  const fmt = (minor: number) => formatMinorGBP(minor);
  const totalDisplay = useMemo(
    () => fmt(totals.totalMinor),
    [totals.totalMinor]
  );

  // ---- Reference code from slug ----
  const refCode = useMemo(
    () => makeRefFromSlug(effectiveSlug),
    [effectiveSlug]
  );

  // ---- Payment reference (no orderRef; just orderId or refCode) ----
  const paymentRef = useMemo(
    () => (orderId ? String(orderId) : refCode),
    [orderId, refCode]
  );

  // ---- last_payment payload builder ----
  const buildLastPayment = () =>
    buildLastPaymentPayload(
      paymentRef,
      totals,
      effectiveSlug,
      appointmentAtIso
    );

  // -----------------------
  // Tell backend: this order is still pending (for this step)
  // -----------------------
  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        await markOrderPaidApi(orderId, {
          payment_status: "pending",
        } as any);
      } catch {
        // ignore; order was probably already pending
      }
    })();
  }, [orderId]);

  // -----------------------
  // Test success (no real charge)
  // -----------------------
  const [testSubmitting, setTestSubmitting] = useState(false);

  const onTestSuccess = async () => {
    if (testSubmitting) return; // prevent double-click locally
    setTestSubmitting(true);

    const payload = buildLastPayment();
    persistLastPayment(payload);

    // ✅ update the order's payment_status via updateOrderApi
    if (orderId) {
      try {
        await updateOrderApi(orderId, {
          payment_status: "paid",
        } as any);
      } catch {
        // ignore failures here; we still redirect
      }
    }

    // ✅ always try to send invoice email (uses fallback if orderId null)
    await sendInvoiceEmailForOrder(orderId || null, payload, effectiveSlug);

    // NOTE: intentionally NOT clearing the cart here,
    // so you can still show the success page again for testing.

    // let the success step know it should send user to home (not first step)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("after_success_redirect", "home");
      } catch {
        // ignore
      }
    }

    const base = `/private-services/${effectiveSlug}/book`;
    const u = new URL(base, window.location.origin);
    u.searchParams.set("step", "success");
    u.searchParams.set("order", orderId || payload.ref);
    u.searchParams.set("slug", effectiveSlug);
    if (appointmentAtIso) {
      u.searchParams.set("appointment_at", appointmentAtIso);
    }

    router.push(u.pathname + u.search + u.hash);
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
          currency: process.env.NEXT_PUBLIC_CONSULTATION_CURRENCY || "GBP",
          reference: paymentRef,
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

        Ryft.addEventHandler("cardValidationChanged", (e: any) => {
          setCardValid(Boolean(e?.isValid));
        });

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
  }, [totals.totalMinor, showPay, paymentRef]);

  // ---- Empty cart guard ----
  if (!totals.lines.length) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white/80 p-8 text-center shadow-lg shadow-slate-200/70">
        <h2 className="text-2xl font-semibold text-slate-900">Payment</h2>
        {appointmentAtPretty ? (
          <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-900">
            Appointment {appointmentAtPretty}
          </div>
        ) : null}
        <p className="mt-4 text-sm text-slate-500">
          Your basket is currently empty.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            href={`/private-services/${effectiveSlug}/book?step=treatments`}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Back to treatments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
      <Script
        src="https://embedded.ryftpay.com/v2/ryft.min.js"
        strategy="afterInteractive"
      />

      {/* Top header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">
            Payment
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Securely complete your booking. We’ll email your receipt and
            invoice as soon as the payment is confirmed.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-medium text-slate-500">
            Reference: {paymentRef}
          </span>
          <span className="text-xl font-semibold text-slate-900">
            {totalDisplay}
          </span>
        </div>
      </header>

      {appointmentAtPretty ? (
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs sm:text-sm text-emerald-900">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium">Appointment:</span>
          <span>{appointmentAtPretty}</span>
        </div>
      ) : null}

      {/* Main layout */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Order summary */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Order summary
            </h3>
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
                  <div className="truncate text-sm font-medium text-slate-900">
                    {it.name}
                  </div>
                  {it.label ? (
                    <div className="truncate text-xs text-slate-600">
                      {it.label}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                    Qty {it.qty}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <span className="text-sm font-semibold text-slate-900">
                    {fmt(it.totalMinor ?? 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Payment column */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-900">Payment</h3>
          <p className="mt-1 text-xs text-slate-500">
            Card details are processed securely by Ryft. We never store your
            full card number.
          </p>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
            <span className="text-sm text-slate-600">Total to pay</span>
            <span className="text-lg font-semibold text-slate-900">
              {totalDisplay}
            </span>
          </div>

          {/* Buttons */}
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={revealPay}
              disabled={initialising}
              className={`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white shadow-sm transition ${
                initialising
                  ? "cursor-wait bg-slate-400"
                  : "bg-slate-900 hover:bg-black"
              }`}
            >
              {initialising ? "Preparing payment…" : "Pay securely"}
            </button>

            <button
              type="button"
              onClick={onTestSuccess}
              disabled={testSubmitting}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {testSubmitting ? "Payment Successfull" : "Test success"}
            </button>

            <Link
              href={`/private-services/${effectiveSlug}/book?step=treatments`}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Back
            </Link>
          </div>

          {/* Embedded Ryft form */}
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

                  try {
                    const paymentSession = await Ryft.attemptPayment({
                      clientSecret,
                    });

                    if (
                      paymentSession?.status === "Approved" ||
                      paymentSession?.status === "Captured"
                    ) {
                      const payload = buildLastPayment();
                      persistLastPayment(payload);

                      // Mark order as paid (if we know it)
                      if (orderId) {
                        try {
                          await markOrderPaidApi(orderId, {
                            payment_status: "paid",
                            payment_reference:
                              paymentSession?.id ||
                              paymentSession?.reference ||
                              payload.ref,
                            amountMinor: payload.amountMinor,
                            provider: "ryft",
                            raw: paymentSession,
                          } as any);
                        } catch {
                          // ignore
                        }
                      }

                      // ✅ always try to send invoice email (will fallback)
                      await sendInvoiceEmailForOrder(
                        orderId || null,
                        payload,
                        effectiveSlug
                      );

                      // In real payment flow we still clear the cart
                      try {
                        clearCart?.();
                      } catch {
                        // ignore
                      }

                      // same redirect behaviour flag as test success
                      if (typeof window !== "undefined") {
                        try {
                          window.localStorage.setItem(
                            "after_success_redirect",
                            "home"
                          );
                        } catch {
                          // ignore
                        }
                      }

                      const base = `/private-services/${effectiveSlug}/book`;
                      const u = new URL(base, window.location.origin);
                      u.searchParams.set("step", "success");
                      u.searchParams.set("order", orderId || payload.ref);
                      u.searchParams.set("slug", effectiveSlug);
                      if (appointmentAtIso) {
                        u.searchParams.set(
                          "appointment_at",
                          appointmentAtIso
                        );
                      }
                      window.location.href = u.pathname + u.search + u.hash;
                      return;
                    }

                    if (paymentSession?.lastError) {
                      const msg = (
                        window as any
                      )?.Ryft?.getUserFacingErrorMessage?.(
                        paymentSession.lastError
                      );
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
                  disabled={
                    !sdkReady || !clientSecret || !cardValid || initialising
                  }
                  className="w-full justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {initialising ? "Loading payment…" : `Pay ${totalDisplay}`}
                </button>
                <div id="ryft-pay-error" className="text-xs text-rose-600">
                  {error}
                </div>
                <p className="text-[11px] text-slate-500">
                  Apple Pay / Google Pay buttons will appear automatically on
                  compatible devices.
                </p>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
