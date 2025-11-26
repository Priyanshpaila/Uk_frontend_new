import Image from "next/image";
import Container from "@/components/ui/Container";
import BadgePill from "@/components/ui/BadgePill";

export default function Hero() {
  return (
    <section className="bg-gradient-to-b from-cyan-50 via-white to-pharmacy-bg py-8 md:py-10">
      <Container>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">

        
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Left panel */}
          <div className="rounded-4xl bg-white p-5 shadow-soft-card md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pharmacy Express Weight Management
            </p>
            <h1 className="mt-3 text-balance text-2xl font-semibold text-slate-900 sm:text-3xl md:text-4xl">
              Lose up to{" "}
              <span className="text-emerald-500">22.5% of your body weight</span>{" "}
              with clinically proven programmes.
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Trusted by thousands of patients across the UK. Managed by UK-trained prescribers with ongoing support.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-soft-card hover:bg-emerald-600"
              >
                Start consultation
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-800 hover:border-cyan-400 hover:bg-cyan-50"
              >
                Reorder
              </button>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-medium text-emerald-700">
                  ★ 4.9 Trustpilot
                </span>
                <span>Rated excellent by our patients</span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-[11px] text-slate-500 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">GPhC registered</p>
                <p>UK pharmacy professionals</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">Clinically proven</p>
                <p>NICE-guidance aligned</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-800">Trusted service</p>
                <p>Discreet and secure</p>
              </div>
            </div>
          </div>

          {/* Right illustration */}
          <div className="flex items-stretch">
            <div className="relative w-full overflow-hidden rounded-4xl bg-gradient-to-br from-slate-900 via-slate-700 to-slate-900 shadow-soft-card">
              <Image
                src="/images/hero-placeholder.jpg"
                alt="Weight management consultation"
                fill
                className="object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-slate-900/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/90 p-3 text-[11px] shadow-lg backdrop-blur">
                <p className="font-semibold text-slate-900">
                  Pharmacy-led weight management
                </p>
                <p className="mt-1 text-slate-600">
                  Appointments within 24 hours · Medication delivered discreetly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
