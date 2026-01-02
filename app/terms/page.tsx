"use client";

import React, { useCallback, useEffect } from "react";
import {
  FileText,
  Info,
  BookOpen,
  UserCheck,
  Stethoscope,
  ShoppingCart,
  CreditCard,
  Truck,
  Package,
  RefreshCw,
  Undo2,
  ClipboardCheck,
  Globe,
  Copyright,
  Lock,
  AlertTriangle,
  ShieldCheck,
  Gavel,
  Pencil,
  Mail,
  MapPin,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";

type TocItem = {
  id: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone?: "emerald" | "blue" | "violet" | "amber" | "slate";
};

const toneStyles = {
  emerald: { ring: "ring-emerald-200/70", bg: "bg-emerald-50", icon: "text-emerald-700", dot: "bg-emerald-500" },
  blue: { ring: "ring-sky-200/70", bg: "bg-sky-50", icon: "text-sky-700", dot: "bg-sky-500" },
  violet: { ring: "ring-violet-200/70", bg: "bg-violet-50", icon: "text-violet-700", dot: "bg-violet-500" },
  amber: { ring: "ring-amber-200/70", bg: "bg-amber-50", icon: "text-amber-700", dot: "bg-amber-500" },
  slate: { ring: "ring-slate-200/80", bg: "bg-slate-50", icon: "text-slate-700", dot: "bg-slate-500" },
} as const;

const toc: TocItem[] = [
  { id: "intro", title: "1. Introduction", Icon: Info, tone: "blue" },
  { id: "definitions", title: "2. Definitions", Icon: BookOpen, tone: "slate" },
  { id: "eligibility", title: "3. Eligibility", Icon: UserCheck, tone: "emerald" },
  { id: "services", title: "4. Services Provided", Icon: Stethoscope, tone: "violet" },
  { id: "ordering", title: "5. Ordering and Acceptance", Icon: ShoppingCart, tone: "blue" },
  { id: "payment", title: "6. Payment Terms", Icon: CreditCard, tone: "emerald" },
  { id: "delivery", title: "7. Delivery", Icon: Truck, tone: "blue" },
  { id: "availability", title: "8. Product Availability", Icon: Package, tone: "slate" },
  { id: "changes", title: "9. Modifications or Cancellations", Icon: RefreshCw, tone: "amber" },
  { id: "returns", title: "10. Returns and Refunds", Icon: Undo2, tone: "amber" },
  { id: "responsibilities", title: "11. Customer Responsibilities", Icon: ClipboardCheck, tone: "slate" },
  { id: "website", title: "12. Use of Website", Icon: Globe, tone: "blue" },
  { id: "ip", title: "13. Intellectual Property", Icon: Copyright, tone: "slate" },
  { id: "privacy", title: "14. Privacy Policy", Icon: Lock, tone: "violet" },
  { id: "liability", title: "15. Limitation of Liability", Icon: AlertTriangle, tone: "amber" },
  { id: "indemnity", title: "16. Indemnity", Icon: ShieldCheck, tone: "emerald" },
  { id: "law", title: "17. Governing Law", Icon: Gavel, tone: "slate" },
  { id: "terms", title: "18. Changes to Terms", Icon: Pencil, tone: "blue" },
  { id: "contact", title: "19. Contact Us", Icon: Mail, tone: "emerald" },
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
        // gives a little breathing room when jumping to section inside scroll container
        "scroll-mt-4",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className={["mt-0.5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1", t.bg, t.ring].join(" ")}>
          <Icon className={["h-6 w-6", t.icon].join(" ")} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={["h-2 w-2 rounded-full", t.dot].join(" ")} />
            <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">{title}</h2>
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
            <span className={["inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1", t.bg, t.ring].join(" ")}>
              <Icon className={["h-4.5 w-4.5", t.icon].join(" ")} />
            </span>
            <span className="line-clamp-1 text-sm text-slate-700">{title}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function TermsAndConditionsPage() {
  /**
   * Key requirement:
   * - ONLY the main content panel (right side) should scroll.
   * - Sidebar + header should stay fixed/visible.
   *
   * This locks BODY scrolling, so you won't get that black/empty space from page overscroll.
   */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Scroll to section inside the right scroll container (works because it is the nearest scrollable ancestor)
  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    /**
     * This page occupies the viewport area UNDER your navbar.
     * Adjust `top-24 md:top-28` if your navbar height differs.
     */
    <section className="fixed inset-x-0 top-24 bottom-0 md:top-28 bg-slate-50">
      {/* Soft background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-slate-100" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-200/50 via-sky-200/50 to-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-[-80px] h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-sky-200/40 via-emerald-200/40 to-amber-200/40 blur-3xl" />

      {/* Shell */}
      <div className="relative mx-auto h-full max-w-6xl px-4 pb-6 sm:px-6">
        {/* Full-height grid; IMPORTANT: min-h-0 prevents content from collapsing/overflow bugs */}
        <div className="grid h-full min-h-0 gap-6 lg:gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* LEFT: fixed sidebar (does NOT scroll with main content) */}
          <aside className="hidden lg:flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">On this page</h3>
                </div>

                <button
                  type="button"
                  onClick={() => goTo("intro")}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Start <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Sidebar can internally scroll if needed, while main rule still holds (page/body never scrolls) */}
              <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1 overscroll-contain">
                <TocLinks onGo={goTo} />

                <div className="mt-6 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Quick notes
                  </div>
                  <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Orders may be refused or cancelled for availability, payment issues, or suspicious activity.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Delivery times are estimates and may be impacted by external factors.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Medicinal products are non-returnable except where we are at fault.
                    </li>
                  </ul>
                </div>

                <p className="mt-5 text-xs leading-relaxed text-slate-500">
                  If you have questions about these Terms, contact us using the details in section 19.
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT: header fixed + ONLY content scrolls */}
          <div className="flex h-full min-h-0 flex-col">
            {/* Fixed header area (never scrolls) */}
            <header className="shrink-0 rounded-3xl border border-white/60 bg-white/70 p-5 shadow-xl backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
                    <FileText className="h-4 w-4 text-slate-700" />
                    Legal <span className="text-slate-400">/</span> Terms & Conditions
                  </div>

                  <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    Terms & Conditions
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Please read these terms carefully before using our services.
                  </p>
                </div>

                {/* Mobile jump control (since sidebar hidden on small screens) */}
                <div className="sm:w-[260px]">
                  <label className="sr-only">Jump to section</label>
                  <select
                    className="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-sky-200"
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) goTo(id);
                    }}
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

                  <button
                    type="button"
                    onClick={() => goTo("intro")}
                    className="mt-3 hidden w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 sm:flex"
                  >
                    Start reading <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Highlights (kept compact; hidden on very small screens to preserve reading area) */}
              <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <UserCheck className="h-4 w-4 text-emerald-700" />
                    Eligibility
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    You must be at least 18 years old to use our services or place orders.
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <CreditCard className="h-4 w-4 text-sky-700" />
                    Secure payments
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Card payments accepted via Stripe and SumUp. Payment is required at checkout.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm lg:block">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Gavel className="h-4 w-4 text-slate-700" />
                    UK law
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Governed by UK law with disputes subject to the courts of England and Wales.
                  </p>
                </div>
              </div>
            </header>

            {/* ONLY SCROLLABLE AREA */}
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 sm:pr-3">
              <div className="space-y-5 pb-14">
                <SectionCard id="intro" title="1. Introduction" Icon={Info} tone="blue">
                  <p>
                    Welcome to <strong>Pharmacy Express</strong>. These Terms and Conditions govern your access to and use
                    of our services, including our website and any associated applications. By using our services you agree
                    to be bound by these Terms. If you do not agree, you must not use our services.
                  </p>
                </SectionCard>

                <SectionCard id="definitions" title="2. Definitions" Icon={BookOpen} tone="slate">
                  <p>
                    <strong>We / us / our</strong> refers to Pharmacy Express Ltd.
                  </p>
                  <p className="mt-3">
                    <strong>You / your / customer</strong> refers to the individual accessing or using our services.
                  </p>
                  <p className="mt-3">
                    <strong>Order</strong> refers to any purchase made through our platform, including prescription and non-prescription products.
                  </p>
                </SectionCard>

                <SectionCard id="eligibility" title="3. Eligibility" Icon={UserCheck} tone="emerald">
                  <p>
                    You must be at least 18 years old to use our services or place orders. By using our services you confirm that you meet this requirement.
                  </p>
                </SectionCard>

                <SectionCard id="services" title="4. Services Provided" Icon={Stethoscope} tone="violet">
                  <p>
                    Pharmacy Express provides NHS and private healthcare services including prescription and over-the-counter medications and prescription delivery across Wakefield and the UK.
                    Our website enables you to order medicines, book consultations and access healthcare information.
                  </p>
                </SectionCard>

                <SectionCard id="ordering" title="5. Ordering and Acceptance" Icon={ShoppingCart} tone="blue">
                  <p>
                    To place an order you must provide accurate and up-to-date information. By placing an order you agree to pay the specified amount including delivery fees.
                    We may refuse or cancel an order if items are unavailable, payment issues arise, or the order appears suspicious.
                  </p>
                </SectionCard>

                <SectionCard id="payment" title="6. Payment Terms" Icon={CreditCard} tone="emerald">
                  <p>
                    We accept card payments via Stripe and SumUp. Payment is required when placing an order. For refund information please refer to our Returns and Refunds policy.
                  </p>
                </SectionCard>

                <SectionCard id="delivery" title="7. Delivery" Icon={Truck} tone="blue">
                  <p>
                    We offer delivery for NHS and private prescriptions and non-prescription items. Delivery times are estimates and may be delayed due to factors outside our control.
                    Prescription deliveries may require approval from healthcare providers before dispatch.
                  </p>
                </SectionCard>

                <SectionCard id="availability" title="8. Product Availability" Icon={Package} tone="slate">
                  <p>
                    All products are subject to availability. We may discontinue products without notice. If an item is unavailable we will offer an alternative or issue a refund.
                  </p>
                </SectionCard>

                <SectionCard id="changes" title="9. Modifications or Cancellations" Icon={RefreshCw} tone="amber">
                  <p>
                    You may modify or cancel an order before dispatch by contacting us. After dispatch changes cannot be made.
                    Please refer to your right to modify or cancel your order for full details.
                  </p>
                </SectionCard>

                <SectionCard id="returns" title="10. Returns and Refunds" Icon={Undo2} tone="amber">
                  <p>
                    For detailed information please see our Damaged Goods, Exchanges, Returns and Refunds policy. Medicinal products are non-returnable except where we are at fault.
                  </p>
                </SectionCard>

                <SectionCard id="responsibilities" title="11. Customer Responsibilities" Icon={ClipboardCheck} tone="slate">
                  <p>
                    You must provide accurate information and agree to use medicinal products as directed by healthcare professionals. Misuse of our services may result in account termination.
                  </p>
                </SectionCard>

                <SectionCard id="website" title="12. Use of Website" Icon={Globe} tone="blue">
                  <p>
                    You agree to use our website lawfully. Prohibited behaviour includes submitting false data, attempting unauthorised system access, or using our services for illegal purposes.
                  </p>
                </SectionCard>

                <SectionCard id="ip" title="13. Intellectual Property" Icon={Copyright} tone="slate">
                  <p>
                    All content including logos, trademarks, text and images belongs to Pharmacy Express Ltd or our licensors. You may not reproduce or distribute content without permission.
                  </p>
                </SectionCard>

                <SectionCard id="privacy" title="14. Privacy Policy" Icon={Lock} tone="violet">
                  <p>
                    Your use of our services is subject to our Privacy Policy which explains how we collect, store and protect your personal information.
                  </p>
                </SectionCard>

                <SectionCard id="liability" title="15. Limitation of Liability" Icon={AlertTriangle} tone="amber">
                  <p>
                    We aim to provide accurate information but cannot guarantee that all content is error-free. Pharmacy Express Ltd is not liable for damages arising from use of our services except where required by law.
                  </p>
                </SectionCard>

                <SectionCard id="indemnity" title="16. Indemnity" Icon={ShieldCheck} tone="emerald">
                  <p>
                    You agree to indemnify Pharmacy Express Ltd against any claims resulting from misuse of our services or breach of these Terms.
                  </p>
                </SectionCard>

                <SectionCard id="law" title="17. Governing Law" Icon={Gavel} tone="slate">
                  <p>
                    These Terms are governed by UK law and disputes are subject to the jurisdiction of the courts of England and Wales.
                  </p>
                </SectionCard>

                <SectionCard id="terms" title="18. Changes to Terms" Icon={Pencil} tone="blue">
                  <p>
                    We may update these Terms at any time. Continued use of our services indicates acceptance of the updated Terms.
                  </p>
                </SectionCard>

                <SectionCard id="contact" title="19. Contact Us" Icon={Mail} tone="emerald">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Mail className="h-4 w-4 text-emerald-700" />
                        Email
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        <strong>info@pharmacy-express.co.uk</strong>
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
                </SectionCard>
              </div>
            </div>
            {/* /scroll area */}
          </div>
        </div>
      </div>
    </section>
  );
}
