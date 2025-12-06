import Image from "next/image";
import Container from "@/components/ui/Container";
import BadgePill from "@/components/ui/BadgePill";

type HeroData = {
  backgroundImage?: string;
  kicker?: string;
  titlePrefix?: string;
  titleHighlight?: string;
  titleSuffix?: string;
  description?: string;
  topPillText?: string;
  topPillSub?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  trustBadge?: string;
  trustText?: string;
  chips?: string[];
  rightBadgeMain?: string;
  rightBadgeSub?: string;
  rightDescription?: string;
  stats?: { label: string; value: string }[];
  rightFeatureChips?: string[];
};

export default function Hero({ data }: { data?: HeroData }) {
  const bg = data?.backgroundImage ?? "/images/hero.jpg";

  const kicker =
    data?.kicker ?? "Pharmacy Express Weight Management";
  const titlePrefix = data?.titlePrefix ?? "Lose up to";
  const titleHighlight =
    data?.titleHighlight ?? "22.5% of your body weight";
  const titleSuffix =
    data?.titleSuffix ?? "with clinically proven programmes.";

  const description =
    data?.description ??
    "Expert weight loss support from UK-trained prescribers, with discreet delivery straight to your door.";

  const topPillText =
    data?.topPillText ?? "Pharmacy Express · Weight management clinic";
  const topPillSub =
    data?.topPillSub ?? "UK-based, GPhC-registered pharmacy";

  const primaryCta = data?.primaryCta ?? {
    label: "Start consultation",
    href: "/consultation",
  };
  const secondaryCta = data?.secondaryCta ?? {
    label: "Reorder",
    href: "/reorder",
  };

  const trustBadge = data?.trustBadge ?? "★ 4.9 Trustpilot";
  const trustText =
    data?.trustText ?? "Rated excellent by our patients";

  const chips =
    data?.chips ??
    [
      "GPhC registered · UK professionals",
      "Clinically proven treatments",
      "Discreet & secure service",
    ];

  const stats =
    data?.stats ??
    [
      { label: "Patients", value: "10k+" },
      { label: "Rating", value: "4.9" },
      { label: "Nationwide", value: "UK" },
    ];

  const rightBadgeMain =
    data?.rightBadgeMain ?? "Pharmacy-led programme";
  const rightBadgeSub = data?.rightBadgeSub ?? "Licensed clinic";
  const rightDescription =
    data?.rightDescription ??
    "Personalised weight management, monitored by UK-registered pharmacists.";

  const rightFeatureChips =
    data?.rightFeatureChips ??
    ["24h appointments", "Discreet delivery", "Ongoing review"];

  return (
    <section className="relative isolate overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={bg}
          alt="Pharmacy weight management banner"
          fill
          priority
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-900/40" />
      </div>

      {/* Glow accents */}
      <div className="pointer-events-none absolute -left-32 top-10 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-40 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />

      <Container>
        <div className="relative py-10 md:py-20">
          {/* Top pill */}
          <div className="mb-6 flex flex-wrap items-center gap-3 text-[11px] text-slate-100/80">
            <BadgePill>{topPillText}</BadgePill>
            <span className="hidden md:inline-block">{topPillSub}</span>
          </div>

          {/* Main hero content */}
          <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            {/* LEFT: headline + CTAs */}
            <div className="max-w-xl text-slate-50">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-200">
                {kicker}
              </p>

              <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl lg:text-[2.9rem]">
                {titlePrefix}{" "}
                <span className="text-emerald-400">
                  {titleHighlight}
                </span>{" "}
                {titleSuffix}
              </h1>

              <p className="mt-4 max-w-md text-sm text-slate-100/85 md:text-base">
                {description}
              </p>

              {/* Primary CTAs */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={primaryCta.href}
                  className="rounded-full bg-emerald-500 px-6 py-2.5 text-xs font-semibold text-white shadow-soft-card shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-600"
                >
                  {primaryCta.label}
                </a>
                <a
                  href={secondaryCta.href}
                  className="rounded-full border border-cyan-200/70 bg-white/90 px-6 py-2.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-white"
                >
                  {secondaryCta.label}
                </a>
                <div className="flex items-center gap-2 text-[11px] text-cyan-100/90">
                  <span className="inline-flex h-5 items-center rounded-full bg-emerald-500/20 px-2 text-[10px] font-medium text-emerald-200">
                    {trustBadge}
                  </span>
                  <span>{trustText}</span>
                </div>
              </div>

              {/* Key reassurance chips */}
              <div className="mt-7 flex flex-wrap gap-2 text-[11px] text-slate-100/90">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center rounded-full bg-slate-950/60 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT: glass card – simplified */}
            <div className="flex justify-end">
              <div className="relative w-full max-w-md overflow-hidden rounded-4xl bg-white/10 p-4 text-[11px] text-slate-100 shadow-soft-card shadow-slate-950/40 ring-1 ring-white/15 backdrop-blur-2xl md:p-5">
                {/* glass glow */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/35 via-white/10 to-emerald-300/15 opacity-90" />

                <div className="relative space-y-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-950/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-50/90 ring-1 ring-white/15">
                      {rightBadgeMain}
                    </span>
                    <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-[10px] font-semibold text-emerald-100 ring-1 ring-emerald-300/50">
                      {rightBadgeSub}
                    </span>
                  </div>

                  {/* One-line description */}
                  <p className="text-[12px] font-medium text-slate-50 md:text-sm">
                    {rightDescription}
                  </p>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-100/85">
                    {stats.map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl bg-white/10 px-2 py-2 ring-1 ring-white/15 backdrop-blur-sm"
                      >
                        <p className="text-sm font-semibold text-white">
                          {s.value}
                        </p>
                        <p>{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tiny feature chips */}
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-100/85">
                    {rightFeatureChips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-950/40 px-2.5 py-1 ring-1 ring-white/10 backdrop-blur-sm"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
