"use client";

import React, { useCallback, useEffect } from "react";
import {
  Building2,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
  Pill,
  Truck,
  RefreshCw,
  BadgeCheck,
  MapPin,
  Phone,
  Mail,
  Users,
  Crown,
  ClipboardCheck,
  ArrowUpRight,
  FileText,
  Info,
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
  { id: "overview", title: "1. About Pharmacy Express", Icon: Info, tone: "blue" },
  { id: "services", title: "2. What We Do", Icon: Stethoscope, tone: "emerald" },
  { id: "how", title: "3. How Our Service Works", Icon: RefreshCw, tone: "violet" },
  { id: "quality", title: "4. Quality, Licensing & Safety", Icon: ShieldCheck, tone: "slate" },
  { id: "coverage", title: "5. Where We Operate", Icon: MapPin, tone: "blue" },
  { id: "leadership", title: "6. Leadership & Registration", Icon: Crown, tone: "amber" },
  { id: "help", title: "7. Need Help?", Icon: Phone, tone: "emerald" },
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

/** Mobile-friendly highlight tile (no horizontal overflow) */
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

export default function AboutPharmacyExpressPage() {
  // Only main content scrolls; body does not.
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
     * Adjust `top-24 md:top-28` to match your navbar height.
     * Added `overflow-x-hidden` to hard-prevent sideways cutting/scroll on mobile.
     */
    <section className="fixed inset-x-0 top-24 bottom-0 md:top-28 bg-slate-50 overflow-x-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-slate-100" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-200/50 via-sky-200/50 to-violet-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-[-80px] h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-sky-200/40 via-emerald-200/40 to-amber-200/40 blur-3xl" />

      <div className="relative mx-auto h-full max-w-6xl px-4 pb-6 sm:px-6">
        <div className="grid h-full min-h-0 gap-6 lg:gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* LEFT: Desktop sidebar */}
          <aside className="hidden lg:flex min-h-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-900">On this page</h3>
                </div>

                <button
                  type="button"
                  onClick={() => goTo("overview")}
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
                    Trust markers
                  </div>
                  <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Licensed UK pharmacy (MHRA-approved medicines).
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      NHS and private services supported.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Free local collection and delivery (where available).
                    </li>
                  </ul>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Phone className="h-4 w-4 text-sky-700" />
                    Need help quickly?
                  </div>
                  <div className="mt-3 grid gap-2">
                    <a
                      href="tel:01924971414"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                    >
                      Call 01924 971414
                    </a>
                    <a
                      href="mailto:info@pharmacy-express.co.uk"
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                    >
                      Email support
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT: Fixed header + ONLY content scrolls */}
          <div className="flex h-full min-h-0 flex-col">
            {/* Header (fixed) — mobile safe */}
            <header className="shrink-0 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur sm:px-4 sm:py-1.5 sm:text-xs">
                    <Building2 className="h-4 w-4 text-slate-700" />
                    Company <span className="text-slate-400">/</span> About Us
                  </div>

                  <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
                    About Pharmacy Express
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Licensed UK pharmacy delivering NHS and private services with care, speed, and clarity.
                  </p>
                </div>

                {/* Jump control */}
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

              {/* MOBILE: 2x2 grid (prevents horizontal cut completely) */}
              <div className="mt-3 sm:hidden">
                <div className="grid grid-cols-2 gap-2">
                  <MobileHighlightTile
                    icon={Stethoscope}
                    title="NHS Services"
                    subtitle="Trusted local provider."
                    tone="emerald"
                  />
                  <MobileHighlightTile
                    icon={HeartPulse}
                    title="Private Clinics"
                    subtitle="Fast appointments."
                    tone="blue"
                  />
                  <MobileHighlightTile
                    icon={ShieldCheck}
                    title="UK Licensed"
                    subtitle="MHRA approved."
                    tone="violet"
                  />
                  <MobileHighlightTile
                    icon={Truck}
                    title="Delivery"
                    subtitle="Free local service."
                    tone="amber"
                  />
                </div>
              </div>

              {/* DESKTOP/TABLET: full cards */}
              <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Stethoscope className="h-4 w-4 text-emerald-700" />
                    NHS Services
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Trusted local provider.</p>
                </div>
                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <HeartPulse className="h-4 w-4 text-sky-700" />
                    Private Clinics
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Fast appointments.</p>
                </div>
                <div className="rounded-2xl border border-violet-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <ShieldCheck className="h-4 w-4 text-violet-700" />
                    UK Licensed
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">MHRA approved.</p>
                </div>
                <div className="rounded-2xl border border-amber-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Truck className="h-4 w-4 text-amber-700" />
                    Delivery
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">Free local service.</p>
                </div>
              </div>
            </header>

            {/* ONLY scrollable content */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 sm:mt-5 sm:pr-3">
              <div className="space-y-5 pb-14">
                <SectionCard id="overview" title="1. About Pharmacy Express" Icon={Info} tone="blue">
                  <p>
                    Welcome to <strong>Pharmacy Express</strong>, your trusted partner in health and wellbeing. We provide high-quality
                    NHS and private healthcare services, offering a wide range of over-the-counter and pharmacy-only treatments designed
                    to support the needs of our community.
                  </p>
                  <p className="mt-3">
                    Pharmacy Express is operated by <strong>Middlestown Enterprises Ltd</strong>, a consortium of pharmacists offering free
                    prescription collection and delivery across Wakefield and throughout the UK. You can reorder prescriptions on our website
                    with optional home delivery and access to additional over-the-counter medicines.
                  </p>
                </SectionCard>

                <SectionCard id="services" title="2. What We Do" Icon={Stethoscope} tone="emerald">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Stethoscope className="h-4 w-4 text-emerald-700" />
                        NHS and private clinical services
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Prescription management, consultations, and tailored healthcare support.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Pill className="h-4 w-4 text-sky-700" />
                        Medicines and treatments
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Over-the-counter and pharmacy-only options, with guidance from professionals.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Truck className="h-4 w-4 text-amber-700" />
                        Free local collection and delivery
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Convenient services for local patients, plus nationwide reach where available.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <RefreshCw className="h-4 w-4 text-violet-700" />
                        Fast online reorders and updates
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Reorder prescriptions online and stay informed with clear progress updates.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="how" title="3. How Our Service Works" Icon={RefreshCw} tone="violet">
                  <p>
                    Our mission is simple: to make healthcare accessible, efficient, and compassionate. Our pharmacists and support team
                    deliver safe, reliable services including prescription management, private consultations, and tailored support.
                  </p>

                  <div className="mt-4 rounded-2xl border border-violet-200/70 bg-violet-50/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Users className="h-4 w-4 text-violet-700" />
                      Clear communication
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700">
                      We will communicate with your surgery if needed and keep you updated on any delays. If you prefer a particular medication brand,
                      our pharmacists will do their best to honour your request (subject to availability and clinical appropriateness).
                    </p>
                  </div>
                </SectionCard>

                <SectionCard id="quality" title="4. Quality, Licensing & Safety" Icon={ShieldCheck} tone="slate">
                  <p>
                    All medicines dispensed by Pharmacy Express carry a UK product licence approved by the{" "}
                    <strong>Medicines and Healthcare products Regulatory Agency (MHRA)</strong>, ensuring high standards of quality and safety.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ClipboardCheck className="h-4 w-4 text-slate-700" />
                        Professional standards
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Dispensing processes aligned with regulatory expectations and safe handling practices.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <BadgeCheck className="h-4 w-4 text-emerald-700" />
                        Technology + expertise
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Our platform combines modern tooling with pharmacist oversight so you can manage prescriptions, book services, and access advice with ease.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="coverage" title="5. Where We Operate" Icon={MapPin} tone="blue">
                  <p>
                    Proudly serving <strong>Wakefield</strong> and communities nationwide with dependable pharmacy services you can trust.
                    We provide free local prescription collection and delivery, and we support wider UK coverage for eligible services.
                  </p>
                </SectionCard>

                <SectionCard id="leadership" title="6. Leadership & Registration" Icon={Crown} tone="amber">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Crown className="h-4 w-4 text-amber-700" />
                        CEO and Superintendent
                      </div>
                      <p className="mt-1 text-sm text-slate-800">
                        <strong>Wasim Malik</strong>
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-700">
                        <strong>GPhC No:</strong> 2066988
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-emerald-700" />
                        Registered Pharmacy
                      </div>
                      <p className="mt-1 text-sm text-slate-800">
                        <strong>9012468</strong>
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        Registered and operating as a licensed UK pharmacy.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="help" title="7. Need Help?" Icon={Phone} tone="emerald">
                  <p>
                    Our customer service team is available to assist you with prescriptions, orders, delivery updates, and general queries.
                  </p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Phone className="h-4 w-4 text-emerald-700" />
                        Call
                      </div>
                      <a
                        href="tel:01924971414"
                        className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
                      >
                        01924 971414
                      </a>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Mail className="h-4 w-4 text-sky-700" />
                        Email
                      </div>
                      <a
                        href="mailto:info@pharmacy-express.co.uk"
                        className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                      >
                        info@pharmacy-express.co.uk
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-slate-700" />
                      Service area
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Wakefield and communities nationwide (service availability may vary by location).
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
