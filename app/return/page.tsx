"use client";

import React, { useCallback, useEffect } from "react";
import {
  FileText,
  RefreshCw,
  Undo2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Package,
  ClipboardCheck,
  BadgeCheck,
  XCircle,
  Mail,
  Phone,
  MapPin,
  ArrowUpRight,
  HelpCircle,
  Scale,
  Truck,
  CreditCard,
} from "lucide-react";

type TocItem = {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "emerald" | "blue" | "violet" | "amber" | "slate";
};

const toneStyles = {
  emerald: {
    ring: "ring-emerald-200/70",
    bg: "bg-emerald-50",
    icon: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  blue: {
    ring: "ring-sky-200/70",
    bg: "bg-sky-50",
    icon: "text-sky-700",
    dot: "bg-sky-500",
  },
  violet: {
    ring: "ring-violet-200/70",
    bg: "bg-violet-50",
    icon: "text-violet-700",
    dot: "bg-violet-500",
  },
  amber: {
    ring: "ring-amber-200/70",
    bg: "bg-amber-50",
    icon: "text-amber-700",
    dot: "bg-amber-500",
  },
  slate: {
    ring: "ring-slate-200/80",
    bg: "bg-slate-50",
    icon: "text-slate-700",
    dot: "bg-slate-500",
  },
} as const;

const toc: TocItem[] = [
  { id: "modify-cancel", title: "1. Modify or Cancel Your Order", Icon: RefreshCw, tone: "blue" },
  { id: "damaged-returns", title: "2. Damaged Goods, Returns & Refunds", Icon: Package, tone: "emerald" },
  { id: "processing", title: "3. Processing Time for Refunds", Icon: Clock, tone: "violet" },
  { id: "exclusions", title: "4. Refund Exclusions", Icon: XCircle, tone: "amber" },
  { id: "further", title: "5. Further Information", Icon: HelpCircle, tone: "slate" },
  { id: "contact", title: "6. Contact Support", Icon: Mail, tone: "emerald" },
];

function SectionCard({
  id,
  title,
  Icon,
  tone = "slate",
  children,
}: React.PropsWithChildren<{
  id: string;
  title: string;
  Icon: TocItem["Icon"];
  tone?: TocItem["tone"];
}>) {
  const t = toneStyles[tone ?? "slate"];
  return (
    <article
      id={id}
      className={[
        "group rounded-3xl border border-slate-200/70 bg-white/80 p-6 backdrop-blur-xl md:p-8",
        "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35)] transition hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.45)]",
        "scroll-mt-4",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            "mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1",
            t.bg,
            t.ring,
          ].join(" ")}
        >
          <Icon className={["h-6 w-6", t.icon].join(" ")} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={["h-2 w-2 rounded-full", t.dot].join(" ")} />
            <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">
              {title}
            </h2>
          </div>

          <div className="mt-3 text-sm leading-relaxed text-slate-700">{children}</div>
        </div>
      </div>
    </article>
  );
}

function TocLinks({ onGo }: { onGo: (id: string) => void }) {
  return (
    <nav aria-label="On this page" className="space-y-1.5">
      {toc.map(({ id, title, Icon, tone = "slate" }) => {
        const t = toneStyles[tone];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onGo(id)}
            className="w-full text-left group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 hover:border-slate-200/70 hover:bg-slate-50/70"
          >
            <span
              className={[
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
                t.bg,
                t.ring,
              ].join(" ")}
            >
              <Icon className={["h-4 w-4", t.icon].join(" ")} />
            </span>
            <span className="line-clamp-1 text-sm text-slate-700">{title}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Mobile compact highlight tile (prevents horizontal cut + saves vertical space) */
function MobileHighlightTile({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tone: keyof typeof toneStyles;
}) {
  const t = toneStyles[tone];
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white/75 p-3 shadow-sm backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={[
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1",
            t.bg,
            t.ring,
          ].join(" ")}
        >
          <Icon className={["h-4 w-4", t.icon].join(" ")} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-slate-900">{title}</div>
          <div className="truncate text-[11px] text-slate-600">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

export default function ReturnsPolicyPage() {
  // Lock body scroll so ONLY the main content panel scrolls.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    /**
     * NOTE: Adjust `top-24 md:top-28` to match your navbar height.
     * `overflow-x-hidden` prevents mobile horizontal cut/scroll.
     */
    <section className="fixed inset-x-0 top-24 bottom-0 md:top-28 bg-slate-50 overflow-x-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-slate-100" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-200/50 via-sky-200/50 to-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-[-80px] h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-sky-200/40 via-emerald-200/40 to-amber-200/40 blur-3xl" />

      <div className="relative mx-auto h-full max-w-6xl px-4 pb-6 sm:px-6">
        <div className="grid h-full min-h-0 gap-6 lg:gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* LEFT: Sidebar (desktop) */}
          <aside className="hidden lg:flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">On this page</h3>
                </div>

                <button
                  type="button"
                  onClick={() => goTo("modify-cancel")}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Start <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1 overscroll-contain">
                <TocLinks onGo={goTo} />

                <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <BadgeCheck className="h-4 w-4 text-emerald-700" />
                    Key rules
                  </div>
                  <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Cancellations only possible before dispatch.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Faulty goods reported within 30 days may qualify for a full refund under CRA 2015.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Medicines cannot be returned once they leave our premises (unless we made an error).
                    </li>
                  </ul>
                </div>

                <p className="mt-5 text-xs leading-relaxed text-slate-500">
                  This policy works alongside our FAQs, Terms & Conditions, and Privacy Policy.
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT: Fixed header + ONLY content scrolls */}
          <div className="flex h-full min-h-0 flex-col">
            {/* Header (fixed) — compact on mobile */}
            <header className="shrink-0 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur sm:px-4 sm:py-1.5 sm:text-xs">
                    <Undo2 className="h-4 w-4 text-slate-700" />
                    Legal <span className="text-slate-400">/</span> Returns Policy
                  </div>

                  <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
                    Returns Policy
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Cancellations, returns, exchanges, and refunds, including exclusions for medicines.
                  </p>
                </div>

                {/* Mobile jump (since sidebar hidden) */}
                <div className="w-full sm:w-[280px]">
                  <select
                    className="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-sky-200 sm:py-2.5"
                    defaultValue=""
                    onChange={(e) => e.target.value && goTo(e.target.value)}
                  >
                    <option value="" disabled>
                      Jump to section…
                    </option>
                    {toc.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* MOBILE: compact highlight tiles (no horizontal cut, less height) */}
              <div className="mt-3 sm:hidden">
                <div className="grid grid-cols-2 gap-2">
                  <MobileHighlightTile
                    icon={RefreshCw}
                    title="Modify / cancel"
                    subtitle="Before dispatch only."
                    tone="blue"
                  />
                  <MobileHighlightTile
                    icon={Scale}
                    title="CRA 2015"
                    subtitle="Faulty goods (30 days)."
                    tone="emerald"
                  />
                  <MobileHighlightTile
                    icon={AlertTriangle}
                    title="Medicine exclusions"
                    subtitle="No returns after leaving."
                    tone="amber"
                  />
                  <MobileHighlightTile
                    icon={Clock}
                    title="Refund timing"
                    subtitle="Processed in 5 days."
                    tone="violet"
                  />
                </div>
              </div>

              {/* TABLET/DESKTOP: full highlight cards */}
              <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <RefreshCw className="h-4 w-4 text-sky-700" />
                    Modify / cancel
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Contact us ASAP—cancellations only before dispatch.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Scale className="h-4 w-4 text-emerald-700" />
                    Consumer Rights Act 2015
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Faulty goods reported within 30 days may qualify for a full refund.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    Medicine exclusions
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Medicines cannot be returned once they leave our premises (unless we made an error).
                  </p>
                </div>
              </div>
            </header>

            {/* ONLY scrollable content */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 sm:mt-5 sm:pr-3">
              <div className="space-y-5 pb-14">
                <SectionCard
                  id="modify-cancel"
                  title="1. Your Right to Modify or Cancel Your Order"
                  Icon={RefreshCw}
                  tone="blue"
                >
                  <p>
                    If you need to modify or cancel your order please contact us as soon as possible. We understand plans may
                    change and we are here to help. Once we receive your request we will confirm whether modifications or
                    cancellation are possible and provide details about any delivery changes product adjustments pricing updates
                    or refunds.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Truck className="h-4 w-4 text-sky-700" />
                        Dispatch rule
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Cancellations can only be completed if your order has not yet been dispatched. Once an order has left our
                        premises we are unable to cancel or alter it.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ClipboardCheck className="h-4 w-4 text-emerald-700" />
                        When changes are possible
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        We can update product quantities, switch items, or amend delivery details. Depending on your order’s
                        dispatch stage, some changes may not be feasible. We will keep communication clear throughout.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  id="damaged-returns"
                  title="2. Damaged Goods, Exchanges, Returns, and Refunds"
                  Icon={Package}
                  tone="emerald"
                >
                  <p>
                    Under the Consumer Rights Act 2015 you are entitled to a full refund for faulty goods reported within 30 days
                    of receiving them. If you receive a damaged incorrect or faulty item we will resolve the issue promptly by
                    offering a replacement or refund including applicable postal costs.
                  </p>

                  <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      Return condition requirements
                    </div>
                    <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
                      <li className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Items must be returned in their original packaging and condition.
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Please contact us during opening hours so we can guide you through the return process and arrange a replacement if needed.
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        For non-medicinal products we accept returns as long as items remain unopened unused in original packaging with hygiene seals intact. You must notify us within 30 days of purchase.
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        We cannot accept returns for non-medicinal products if hygiene seals are broken.
                      </li>
                      <li className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Return shipping costs for non-faulty non-medicinal items will be your responsibility. Once inspected we will issue a refund or exchange as requested.
                      </li>
                    </ul>
                  </div>
                </SectionCard>

                <SectionCard id="processing" title="3. Processing Time for Refunds" Icon={Clock} tone="violet">
                  <p>
                    Refunds are processed within <strong>5 working days</strong> of receiving your returned item. Times may vary depending on your bank or card provider.
                    Refunds will be issued via <strong>Stripe</strong> or <strong>SumUp</strong> depending on your original payment method.
                    If you do not see the refund within <strong>7–10 working days</strong> please check with your bank first.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Clock className="h-4 w-4 text-violet-700" />
                        Typical timeline
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        We process refunds within 5 working days after receiving the returned item.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <CreditCard className="h-4 w-4 text-sky-700" />
                        Bank processing
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Banks and card providers may take 7–10 working days to show the refund. Please check with them first if delayed.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="exclusions" title="4. Refund Exclusions" Icon={XCircle} tone="amber">
                  <p>
                    Due to strict safety and regulatory requirements we cannot accept returns or exchanges for <strong>medicinal products</strong> once they have left our premises.
                    This applies whether or not the packaging has been opened. This policy ensures medicines remain safe and uncompromised.
                  </p>

                  <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <AlertTriangle className="h-4 w-4 text-amber-700" />
                      Exception (our error)
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      If there is any error on our part such as receiving an incorrect item or missing item we will accept returns and issue a full refund.
                      Returned medicinal products will be safely destroyed according to regulatory guidelines.
                    </p>
                  </div>
                </SectionCard>

                <SectionCard id="further" title="5. Further Information" Icon={HelpCircle} tone="slate">
                  <p>
                    For more details please refer to our FAQs Terms and Conditions and Privacy Policy. If you need support our customer service team is always available to assist you.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <HelpCircle className="h-4 w-4 text-slate-700" />
                        FAQs
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Quick answers to common questions about orders and returns.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FileText className="h-4 w-4 text-slate-700" />
                        Terms & Conditions
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Service rules, eligibility, ordering, and liability.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-emerald-700" />
                        Privacy Policy
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        How we collect, store, and protect your data.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="contact" title="6. Contact Support" Icon={Mail} tone="emerald">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Mail className="h-4 w-4 text-emerald-700" />
                        Email
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        <strong>info@pharmacy-express.co.uk</strong>
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        Contact us as soon as possible for modifications or cancellations before dispatch.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <MapPin className="h-4 w-4 text-sky-700" />
                        Address
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">
                        <strong>Pharmacy Express</strong>
                        <br />
                        Unit 4, The Office Campus
                        <br />
                        Paragon Business Park
                        <br />
                        Wakefield, WF1 2UY
                        <br />
                        United Kingdom
                      </p>
                    </div>
                  </div>

                  {/* Optional phone block (kept compact) */}
                  <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Phone className="h-4 w-4 text-slate-700" />
                      Phone (optional)
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      If you want, share your support number and I will place it here with click-to-call support.
                    </p>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
