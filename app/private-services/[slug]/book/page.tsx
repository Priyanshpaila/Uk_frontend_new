"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import Container from "@/components/ui/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchServiceBySlug,
  type ServiceDetail,
} from "@/lib/api";
import toast from "react-hot-toast";
import { useCart } from "@/components/cart/cart-context";

/* -------------------------------------------------------------------------- */
/*                              STEP CONFIG / TYPES                           */
/* -------------------------------------------------------------------------- */

export type StepKey =
  | "treatments"
  | "login"
  | "raf"
  | "calendar"
  | "payment"
  | "success";

const TreatmentsStep = dynamic(() => import("./steps/TreatmentsStep"), {
  ssr: false,
});
const LoginStep = dynamic(() => import("./steps/LoginStep"), { ssr: false });
const RafStep = dynamic(() => import("./steps/RafStep"), { ssr: false });
const CalendarStep = dynamic(() => import("./steps/CalendarStep"), {
  ssr: false,
});
const PaymentStep = dynamic(() => import("./steps/PaymentStep"), {
  ssr: false,
});
const SuccessStep = dynamic(() => import("./steps/SuccessStep"), {
  ssr: false,
});

const BASE_FLOW: StepKey[] = [
  "treatments",
  "login",
  "raf",
  "calendar",
  "payment",
  "success",
];

const STEP_LABEL: Record<StepKey, string> = {
  treatments: "Treatments",
  login: "Login",
  raf: "Medical questions",
  calendar: "Choose time",
  payment: "Payment",
  success: "Confirmation",
};

// per-service slug key for step persistence
const STEP_STORAGE_KEY = (slug: string) => `booking_step.${slug}`;

// keep RAF section index key in sync with cleanup
const RAF_SECTION_STORAGE_KEY = (slug: string) => `raf_section.${slug}`;

/**
 * Clear booking-specific storage for a given service slug.
 * (We still clear order-related keys here, but this page no longer creates orders.)
 */
function clearBookingStateForSlug(slug: string) {
  if (typeof window === "undefined" || !slug) return;

  const ls = window.localStorage;
  const ss = window.sessionStorage;

  const keys = [
    // appointment / calendar selection
    "appointment_at",
    "appointment_date",
    "appointment_time",
    "appointment_time_label",
    "appointment_pretty",
    "selected_appointment_at",
    "booking_at",
    "calendar_selected_at",

    // schedule + booking routing
    "schedule_id",
    "booking_next",
    "booking_slug",

    // order-specific (note: no creation here, just cleanup)
    "order_id",
    "order_last_body",

    // consultation session
    "consultation_session_id",
    "pe_consultation_session_id",
    "consultationSessionId",

    // raf helper keys (but NOT raf_answers.*)
    "last_raf",
    STEP_STORAGE_KEY(slug),
    RAF_SECTION_STORAGE_KEY(slug),
  ];

  for (const key of keys) {
    if (!key) continue;
    try {
      ls.removeItem(key);
    } catch {}
    try {
      ss.removeItem(key);
    } catch {}
  }

  // clear consultation cookie
  try {
    document.cookie =
      "pe_consultation_session_id=; Max-Age=0; path=/; SameSite=Lax";
  } catch {}
}

/* -------------------------------------------------------------------------- */
/*                               MAIN PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function BookServicePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const { user } = useAuth();

  // 🔐 "Logged in" is now *only* based on AuthProvider user state
  const isLoggedIn = !!user;

  // Cart info for gating + summary (raw, from context)
  const cart = useCart() as any;
  const cartItems: any[] = Array.isArray(cart?.items)
    ? cart.items
    : Array.isArray(cart?.state?.items)
    ? cart.state.items
    : [];

  // ✅ Client-only view of cart, to avoid hydration mismatch
  const [clientCartReady, setClientCartReady] = React.useState(false);
  const [clientCartCount, setClientCartCount] = React.useState(0);

  React.useEffect(() => {
    setClientCartCount(cartItems.length);
    setClientCartReady(true);
  }, [cartItems.length]);

  const hasCartItems = clientCartReady && clientCartCount > 0;

  // Service details
  const [service, setService] = React.useState<ServiceDetail | null>(null);
  const [serviceLoading, setServiceLoading] = React.useState(true);

  // Flow & step state
  const flow = React.useMemo<StepKey[]>(
    () => (isLoggedIn ? BASE_FLOW.filter((s) => s !== "login") : BASE_FLOW),
    [isLoggedIn]
  );
  const [currentStep, setCurrentStep] =
    React.useState<StepKey>("treatments");

  /* ---------- Load service detail (by slug) & store service_id locally ----- */

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!slug) return;
        setServiceLoading(true);
        const s = await fetchServiceBySlug(slug);

        if (cancelled) return;

        setService(s);

        // ✅ store service_id & slug in local/session storage (used by other steps/pages)
        try {
          if (typeof window !== "undefined" && (s as any)?._id) {
            const sid = String((s as any)._id);
            window.localStorage.setItem("service_id", sid);
            window.sessionStorage.setItem("service_id", sid);
            window.localStorage.setItem("service_slug", slug);
            window.sessionStorage.setItem("service_slug", slug);
          }
        } catch {
          // ignore storage errors
        }
      } catch (e) {
        console.error("Failed to load service detail", e);
      } finally {
        if (!cancelled) setServiceLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  /* ---------- Restore current step from localStorage on mount ---------- */

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug) return;

    try {
      const raw = window.localStorage.getItem(STEP_STORAGE_KEY(slug));
      if (!raw) return;

      const allSteps: StepKey[] = [
        "treatments",
        "login",
        "raf",
        "calendar",
        "payment",
        "success",
      ];

      if (!allSteps.includes(raw as StepKey)) return;

      let step = raw as StepKey;

      // If user is logged in, never land on login step
      if (isLoggedIn && step === "login") {
        const idxInBase = BASE_FLOW.indexOf("login");
        step = (BASE_FLOW[idxInBase + 1] ?? "treatments") as StepKey;
      }

      // If NOT logged in and we previously stored a later step,
      // force them back to the login step
      if (!isLoggedIn && step !== "treatments" && step !== "login") {
        step = "login";
      }

      // Ensure this step exists in the current flow (login can be removed)
      if (!flow.includes(step)) {
        step = "treatments";
      }

      setCurrentStep(step);
    } catch {
      // ignore
    }
  }, [slug, isLoggedIn, flow]);

  // 💾 Persist current step whenever it changes
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug) return;
    try {
      window.localStorage.setItem(STEP_STORAGE_KEY(slug), currentStep);
    } catch {
      // ignore
    }
  }, [slug, currentStep]);

  const currentIndex = React.useMemo(() => {
    const idx = flow.indexOf(currentStep);
    return idx >= 0 ? idx : 0;
  }, [flow, currentStep]);

  const nextStep: StepKey | null =
    currentIndex < flow.length - 1 ? flow[currentIndex + 1] : null;
  const prevStep: StepKey | null =
    currentIndex > 0 ? flow[currentIndex - 1] : null;

  // If user becomes logged in while on "login" step, jump forward
  React.useEffect(() => {
    if (isLoggedIn && currentStep === "login") {
      const idxInBase = BASE_FLOW.indexOf("login");
      const afterLogin = BASE_FLOW[idxInBase + 1] ?? "treatments"; // usually "raf"
      setCurrentStep(afterLogin);
    }
  }, [isLoggedIn, currentStep]);

  // 🔄 When user reaches the final "success" step, clear old booking/order state
  React.useEffect(() => {
    if (!slug) return;
    if (currentStep === "success") {
      clearBookingStateForSlug(slug);
    }
  }, [slug, currentStep]);

  /* ---------- Guards (no order creation here) ---------- */

  const canProceedFrom = React.useCallback(
    (step: StepKey): { ok: boolean; message?: string } => {
      if (step === "treatments" && !hasCartItems) {
        return {
          ok: false,
          message:
            "Please add at least one treatment/medicine to your basket before continuing.",
        };
      }

      if (step === "login" && !isLoggedIn) {
        return {
          ok: false,
          message: "Please log in or create an account before continuing.",
        };
      }

      return { ok: true };
    },
    [hasCartItems, isLoggedIn]
  );

  /* ---------- Navigation handlers (just step changes) ---------- */

  const handleNext = () => {
    if (!nextStep) return;

    const guard = canProceedFrom(currentStep);
    if (!guard.ok) {
      if (guard.message) toast.error(guard.message);
      return;
    }

    // ❌ No order creation here anymore
    setCurrentStep(nextStep);
  };

  const handlePrev = () => {
    if (!prevStep) return;
    setCurrentStep(prevStep);
  };

  const maxClickableIndex = currentIndex; // cannot skip ahead
  const nextButtonLabel =
    nextStep === "payment"
      ? "Continue to payment"
      : nextStep === "success"
      ? "Complete booking"
      : "Next";

  const nextDisabled =
    !nextStep ||
    (currentStep === "treatments" && !hasCartItems) ||
    (currentStep === "login" && !isLoggedIn);

  /* ---------- Render ---------- */

  const CurrentStepComponent =
    currentStep === "treatments"
      ? TreatmentsStep
      : currentStep === "login"
      ? LoginStep
      : currentStep === "raf"
      ? RafStep
      : currentStep === "calendar"
      ? CalendarStep
      : currentStep === "payment"
      ? PaymentStep
      : SuccessStep;

  return (
    <main className="min-h-screen bg-pharmacy-bg py-6 md:py-10">
      <Container>
        <div className="mx-auto max-w-5xl">
          {/* Back link + title */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                (window.location.href = `/private-services/${slug}`)
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-cyan-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to service
            </button>

            {service && (
              <div className="hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] text-slate-600 shadow-sm md:flex">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                <span className="font-semibold text-slate-800">
                  Booking {service.name}
                </span>
              </div>
            )}
          </div>

          {/* Card wrapper */}
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-soft-card md:p-6">
            {/* Stepper tabs */}
            <div className="mb-5 flex flex-wrap gap-2 rounded-3xl bg-slate-50 p-2 text-[11px] text-slate-600">
              {flow.map((step, idx) => {
                const isActive = idx === currentIndex;
                const isCompleted = idx < currentIndex;
                const disabled = idx > maxClickableIndex;

                return (
                  <button
                    key={step}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (!disabled) setCurrentStep(step);
                    }}
                    className={[
                      "flex-1 min-w-[80px] rounded-2xl px-3 py-2 flex items-center justify-center gap-1.5 font-medium transition",
                      disabled
                        ? "cursor-not-allowed opacity-50"
                        : "hover:bg-white",
                      isActive
                        ? "bg-slate-900 text-white shadow"
                        : isCompleted
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-transparent text-slate-600",
                    ].join(" ")}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                      {idx + 1}
                    </span>
                    <span>{STEP_LABEL[step]}</span>
                  </button>
                );
              })}
            </div>

            {/* Service heading */}
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Booking journey
                </p>
                <h1 className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
                  {service?.name || "Book your private treatment"}
                </h1>
                {service?.description && (
                  <p className="mt-1 max-w-2xl text-xs text-slate-500 md:text-sm">
                    {service.description}
                  </p>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 md:mt-0">
                <span>
                  Step {currentIndex + 1} of {flow.length}
                </span>
                {/* ✅ Only render badge after client knows cart count */}
                {clientCartReady && clientCartCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    {clientCartCount} item
                    {clientCartCount > 1 ? "s" : ""} in basket
                  </span>
                )}
              </div>
            </div>

            {/* Step content */}
            <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:p-4">
              {serviceLoading ? (
                <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <CurrentStepComponent
                  serviceSlug={slug}
                  autoContinue={currentStep === "treatments"}
                />
              )}
            </div>

            {/* Footer controls (hidden on success) */}
            {currentStep !== "success" && (
              <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-200 pt-3 text-xs md:flex-row md:items-center">
                <div className="text-[11px] text-slate-500">
                  Please complete each step carefully. You can&apos;t skip
                  ahead without finishing the current step.
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={!prevStep}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-800 shadow-sm hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={nextDisabled}
                    className="inline-flex items-center rounded-full bg-emerald-600 px-5 py-2 text-[11px] font-semibold text-white shadow-soft-card hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {nextButtonLabel} →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </main>
  );
}
