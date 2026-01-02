"use client";

import React, { useCallback, useEffect } from "react";
import {
  FileText,
  Info,
  Database,
  Stethoscope,
  CreditCard,
  ShieldCheck,
  Scale,
  Share2,
  Lock,
  Archive,
  UserCheck,
  Cookie,
  RefreshCw,
  Mail,
  MapPin,
  AlertTriangle,
  BadgeCheck,
  ArrowUpRight,
  Gavel,
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
  { id: "intro", title: "1. Introduction", Icon: Info, tone: "blue" },
  { id: "collect", title: "2. Information We Collect", Icon: Database, tone: "slate" },
  { id: "use", title: "3. How We Use Your Information", Icon: Stethoscope, tone: "emerald" },
  { id: "legal", title: "4. Legal Basis for Processing", Icon: Scale, tone: "violet" },
  { id: "sharing", title: "5. Sharing Your Information", Icon: Share2, tone: "blue" },
  { id: "security", title: "6. Security", Icon: Lock, tone: "emerald" },
  { id: "retention", title: "7. Data Retention", Icon: Archive, tone: "slate" },
  { id: "rights", title: "8. Your Rights", Icon: UserCheck, tone: "emerald" },
  { id: "cookies", title: "9. Cookies", Icon: Cookie, tone: "amber" },
  { id: "changes", title: "10. Changes to This Policy", Icon: RefreshCw, tone: "blue" },
  { id: "contact", title: "11. Contact Us", Icon: Mail, tone: "emerald" },
  { id: "complaints", title: "12. Complaints", Icon: AlertTriangle, tone: "amber" },
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

export default function PrivacyPolicyPage() {
  // Lock body scroll so ONLY the main content panel scrolls (no black/empty space).
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
     * `overflow-x-hidden` prevents any horizontal cut/scroll on mobile.
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
                  onClick={() => goTo("intro")}
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
                    Highlights
                  </div>
                  <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      We do not sell or rent your personal information.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Health records may be retained for 10 years or longer under NHS standards.
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      You can request access, correction, deletion (where applicable), restriction, and portability.
                    </li>
                  </ul>
                </div>

                <p className="mt-5 text-xs leading-relaxed text-slate-500">
                  This policy explains how Pharmacy Express collects, uses, stores, and safeguards personal data.
                </p>
              </div>
            </div>
          </aside>

          {/* RIGHT: Header fixed + ONLY content scrolls */}
          <div className="flex h-full min-h-0 flex-col">
            {/* Header (fixed) — compact on mobile */}
            <header className="shrink-0 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-xl backdrop-blur-xl sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur sm:px-4 sm:py-1.5 sm:text-xs">
                    <ShieldCheck className="h-4 w-4 text-slate-700" />
                    Legal <span className="text-slate-400">/</span> Privacy Policy
                  </div>

                  <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:mt-4 sm:text-3xl">
                    Privacy Policy
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    How we collect, use, store, and protect personal data across our NHS services, private services,
                    and digital platforms.
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

              {/* MOBILE: compact highlights grid (no horizontal cut, less height) */}
              <div className="mt-3 sm:hidden">
                <div className="grid grid-cols-2 gap-2">
                  <MobileHighlightTile
                    icon={Lock}
                    title="Security first"
                    subtitle="Encryption & audits."
                    tone="blue"
                  />
                  <MobileHighlightTile
                    icon={Scale}
                    title="Legal compliance"
                    subtitle="Consent & obligations."
                    tone="emerald"
                  />
                  <MobileHighlightTile
                    icon={Gavel}
                    title="Complaints (ICO)"
                    subtitle="Raise concerns."
                    tone="amber"
                  />
                </div>
              </div>

              {/* TABLET/DESKTOP: full highlight cards */}
              <div className="mt-5 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-sky-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Lock className="h-4 w-4 text-sky-700" />
                    Security first
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Encryption, secure servers, access controls, staff training, and regular audits.
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Scale className="h-4 w-4 text-emerald-700" />
                    Legal compliance
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Processing under consent, contract, legal obligations, and legitimate interests.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200/70 bg-white/70 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Gavel className="h-4 w-4 text-amber-700" />
                    Complaints (ICO)
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    You can raise concerns with the Information Commissioner’s Office.
                  </p>
                </div>
              </div>
            </header>

            {/* ONLY scrollable content */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 sm:mt-5 sm:pr-3">
              <div className="space-y-5 pb-14">
                <SectionCard id="intro" title="1. Introduction" Icon={Info} tone="blue">
                  <p>
                    Pharmacy Express respects your privacy and is committed to protecting your personal data. This privacy policy
                    explains how we collect use store and safeguard your information when you use our website private health services
                    NHS services management system and all related digital platforms.
                  </p>
                  <p className="mt-3">
                    Our platform supports NHS services private clinical services and the sale of both over-the-counter and pharmacy-only
                    medications. We also operate a secure backend system where customers become registered patients enabling pharmacists
                    to manage prescriptions bookings orders and health information safely.
                  </p>
                </SectionCard>

                <SectionCard id="collect" title="2. Information We Collect" Icon={Database} tone="slate">
                  <p className="mb-3">
                    We collect the following types of personal data to deliver our services effectively:
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Stethoscope className="h-4 w-4 text-emerald-700" />
                        Patient Data
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Including name date of birth NHS number medical history prescription details and other health data.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <UserCheck className="h-4 w-4 text-sky-700" />
                        Customer Data
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Including contact details account information order history and payment details.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FileText className="h-4 w-4 text-slate-700" />
                        Booking Information
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Such as appointments for NHS and private services.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <CreditCard className="h-4 w-4 text-violet-700" />
                        Transaction Data
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Including payment information billing address and purchase history.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Lock className="h-4 w-4 text-amber-700" />
                        Technical Data
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Such as IP address browser type operating system and data collected via cookies.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Mail className="h-4 w-4 text-emerald-700" />
                        Communication Data
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Including messages emails and customer support interactions.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="use" title="3. How We Use Your Information" Icon={Stethoscope} tone="emerald">
                  <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                    {[
                      "To provide NHS and private healthcare services including consultations and prescription management.",
                      "To deliver medicines and manage your orders accurately.",
                      "To verify your identity process payments and manage your account securely.",
                      "To maintain patient records for continuity of care.",
                      "To improve our services through analytics feedback and platform optimisation.",
                      "To communicate important updates health information and service notifications.",
                      "To comply with legal regulatory and professional healthcare obligations.",
                    ].map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard id="legal" title="4. Legal Basis for Processing" Icon={Scale} tone="violet">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <BadgeCheck className="h-4 w-4 text-violet-700" />
                        Consent
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        For optional communications and marketing.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <FileText className="h-4 w-4 text-sky-700" />
                        Contractual necessity
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        When providing healthcare or fulfilling orders.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Gavel className="h-4 w-4 text-amber-700" />
                        Legal obligations
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Including compliance with healthcare regulations.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <ShieldCheck className="h-4 w-4 text-emerald-700" />
                        Legitimate interests
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        Such as platform security and service improvement.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="sharing" title="5. Sharing Your Information" Icon={Share2} tone="blue">
                  <p>We may share your personal data with the following parties:</p>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                    {[
                      "Healthcare professionals involved in your treatment.",
                      "Trusted service providers for payments hosting logistics and support.",
                      "Legal authorities when required for safety law or compliance.",
                    ].map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-sky-500" />
                        {x}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      No selling of data
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      We do not sell or rent your personal information to third parties.
                    </p>
                  </div>
                </SectionCard>

                <SectionCard id="security" title="6. Security" Icon={Lock} tone="emerald">
                  <p>
                    We use encryption secure servers access controls staff training and regular audits to protect your personal data
                    from unauthorised access loss or misuse.
                  </p>
                </SectionCard>

                <SectionCard id="retention" title="7. Data Retention" Icon={Archive} tone="slate">
                  <p>
                    We retain your data for as long as necessary to fulfil service purposes and comply with legal requirements.
                    Health records follow NHS retention standards and may need to be stored for{" "}
                    <strong>10 years or longer</strong> depending on regulation.
                  </p>
                </SectionCard>

                <SectionCard id="rights" title="8. Your Rights" Icon={UserCheck} tone="emerald">
                  <p className="mb-3">You have the following rights:</p>
                  <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
                    {[
                      "Right to access your personal data.",
                      "Right to request corrections.",
                      "Right to request deletion where applicable.",
                      "Right to restrict processing.",
                      "Right to data portability.",
                      "Right to withdraw consent.",
                    ].map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard id="cookies" title="9. Cookies" Icon={Cookie} tone="amber">
                  <p>
                    We use cookies to enhance user experience and analyse website usage. For full details please refer to our Cookie Policy.
                  </p>
                </SectionCard>

                <SectionCard id="changes" title="10. Changes to This Policy" Icon={RefreshCw} tone="blue">
                  <p>
                    We may update this Privacy Policy occasionally. Significant changes will be communicated through our website or other appropriate channels.
                  </p>
                </SectionCard>

                <SectionCard id="contact" title="11. Contact Us" Icon={Mail} tone="emerald">
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
                        <strong>Unit 4, The Office Campus</strong>
                        <br />
                        Paragon Business Park
                        <br />
                        Wakefield WF1 2UY
                        <br />
                        United Kingdom
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard id="complaints" title="12. Complaints" Icon={AlertTriangle} tone="amber">
                  <p>
                    You have the right to lodge a complaint with the Information Commissioner’s Office (ICO) if you feel your data rights have not been respected.
                    Visit <strong>www.ico.org.uk</strong> for details.
                  </p>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
