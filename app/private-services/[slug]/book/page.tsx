"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  useParams,
  useRouter,
  useSearchParams,
  usePathname,
} from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import Container from "@/components/ui/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchServiceBySlug, type ServiceDetail } from "@/lib/api";
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

// RAF storage keys
const RAF_FORM_ID_KEY = (slug: string) => `raf_form_id.${slug}`;
const RAF_LABELS_KEY = (slug: string) => `raf_labels.${slug}`;
const RAF_ANSWERS_KEY = (slug: string) => `raf_answers.${slug}`;
const RAF_ANSWERS_LEGACY_KEY = (slug: string) => `raf.answers.${slug}`;
const RAF_ANSWERS_ASSESS_KEY = (slug: string) => `assessment.answers.${slug}`;

/* -------------------------------------------------------------------------- */
/*                         RAF FORM ASSIGNMENT HELPERS                        */
/* -------------------------------------------------------------------------- */

function normaliseType(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function pickId(v: any): string | undefined {
  if (!v) return undefined;
  const id =
    v?.form_id ??
    v?.formId ??
    v?.clinic_form_id ??
    v?.clinicFormId ??
    v?.clinic_form?._id ??
    v?.clinicForm?._id ??
    v?.form?._id ??
    v?._id;

  if (!id) return undefined;
  const s = String(id).trim();
  return s ? s : undefined;
}

function parseMaybeJson(v: any): any {
  if (!v) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (typeof v === "object") return v;
  return null;
}

function extractAssignedRafFormId(service: any): string | undefined {
  if (!service) return undefined;

  // direct fields (keep)
  const direct =
    service?.raf_form_id ??
    service?.rafFormId ??
    service?.raf_form?._id ??
    service?.rafForm?._id;
  if (direct) return String(direct).trim();

  // ✅ YOUR DB FIELD: forms_assignment (stringified JSON)
  const formsAssignmentRaw =
    service?.forms_assignment ??
    service?.formsAssignment ??
    service?.forms_assignment_json ??
    service?.formsAssignmentJson;

  const parsed = parseMaybeJson(formsAssignmentRaw);
  const rafFromMap =
    parsed?.raf ?? parsed?.RAF ?? parsed?.risk_assessment ?? parsed?.assessment;
  if (rafFromMap) return String(rafFromMap).trim();

  // existing array-based fallbacks (keep your current logic)
  const assignments =
    service?.form_assignments ??
    service?.formAssignments ??
    service?.form_assignment ??
    service?.formAssignment ??
    service?.assigned_forms ??
    service?.assignedForms ??
    service?.forms ??
    service?.clinic_forms ??
    service?.clinicForms;

  const list = Array.isArray(assignments) ? assignments : [];

  const pickId = (v: any): string | undefined => {
    if (!v) return undefined;
    const id =
      v?.form_id ??
      v?.formId ??
      v?.clinic_form_id ??
      v?.clinicFormId ??
      v?.clinic_form?._id ??
      v?.clinicForm?._id ??
      v?.form?._id ??
      v?._id;
    if (!id) return undefined;
    const s = String(id).trim();
    return s ? s : undefined;
  };

  const normaliseType = (v: any) =>
    String(v ?? "")
      .trim()
      .toLowerCase();

  const rafLike = list.find((a: any) => {
    const t =
      normaliseType(a?.form_type) ||
      normaliseType(a?.type) ||
      normaliseType(a?.kind) ||
      normaliseType(a?.category);

    const name = normaliseType(a?.name) || normaliseType(a?.title);
    const active =
      a?.active === undefined
        ? true
        : Boolean(a?.active) && a?.deleted_at == null;

    const isRaf =
      t === "raf" ||
      t === "risk_assessment" ||
      t === "risk-assessment" ||
      t === "assessment" ||
      name === "raf" ||
      name.includes("risk") ||
      name.includes("assessment");

    return active && isRaf && !!pickId(a);
  });

  if (rafLike) return pickId(rafLike);

  const firstActive = list.find((a: any) => {
    const active =
      a?.active === undefined
        ? true
        : Boolean(a?.active) && a?.deleted_at == null;
    return active && !!pickId(a);
  });

  return firstActive ? pickId(firstActive) : undefined;
}

function safeGetLocal(key: string): string | undefined {
  try {
    const v = window.localStorage.getItem(key);
    const s = String(v ?? "").trim();
    return s ? s : undefined;
  } catch {
    return undefined;
  }
}

function clearRafCacheForSlug(slug: string) {
  if (typeof window === "undefined" || !slug) return;
  try {
    window.localStorage.removeItem(RAF_ANSWERS_KEY(slug));
    window.localStorage.removeItem(RAF_ANSWERS_LEGACY_KEY(slug));
    window.localStorage.removeItem(RAF_ANSWERS_ASSESS_KEY(slug));
    window.localStorage.removeItem(RAF_LABELS_KEY(slug));
    window.localStorage.removeItem(RAF_SECTION_STORAGE_KEY(slug));
    // do NOT remove RAF_FORM_ID_KEY here; caller will set the new value
  } catch {}

  // Clear last_raf only if it belongs to this slug
  try {
    const last = window.localStorage.getItem("last_raf");
    if (last) {
      const parsed = JSON.parse(last);
      if (parsed?.slug === slug) window.localStorage.removeItem("last_raf");
    }
  } catch {}
}

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

    // order-specific
    "order_id",
    "order_last_body",

    // consultation session
    "consultation_session_id",
    "pe_consultation_session_id",
    "consultationSessionId",

    // raf helper keys (but NOT raf_answers.* by default)
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

  try {
    document.cookie =
      "pe_consultation_session_id=; Max-Age=0; path=/; SameSite=Lax";
  } catch {}
}

/* -------------------------------------------------------------------------- */
/*                        SERVICE FLOW PARSING HELPERS                        */
/* -------------------------------------------------------------------------- */

function normaliseFlowLabelToStepKey(label: any): StepKey | null {
  if (!label) return null;
  const s = String(label).trim().toLowerCase();

  if (s === "treatments" || s === "treatment") return "treatments";
  if (s === "login" || s === "sign in" || s === "signin") return "login";
  if (s === "raf" || s === "medical questions" || s === "medical") return "raf";
  if (s === "calendar" || s === "choose time" || s === "schedule")
    return "calendar";
  if (s === "payment" || s === "pay") return "payment";
  if (s === "success" || s === "confirmation" || s === "complete")
    return "success";

  return null;
}

function parseServiceFlow(flowJson?: string | null): StepKey[] | null {
  if (!flowJson) return null;

  try {
    const obj = JSON.parse(String(flowJson));
    if (!obj || typeof obj !== "object") return null;

    const orderedKeys = Object.keys(obj)
      .filter((k) => /^step\d+$/i.test(k))
      .sort((a, b) => {
        const na = parseInt(a.replace(/^\D+/g, ""), 10) || 0;
        const nb = parseInt(b.replace(/^\D+/g, ""), 10) || 0;
        return na - nb;
      });

    const out: StepKey[] = [];
    const seen = new Set<string>();

    for (const k of orderedKeys) {
      const stepKey = normaliseFlowLabelToStepKey((obj as any)[k]);
      if (!stepKey) continue;
      if (seen.has(stepKey)) continue;
      seen.add(stepKey);
      out.push(stepKey);
    }

    if (!out.length) return null;

    if (!out.includes("success")) out.push("success");
    else {
      const without = out.filter((x) => x !== "success");
      out.splice(0, out.length, ...without, "success");
    }

    return out;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                               MAIN PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function BookServicePage() {
  const params = useParams<{ slug: string }>();
  const slugFromRoute = params?.slug ?? "";

  const pathname = usePathname();
  const isReorderRoute = React.useMemo(() => {
    const p = (pathname || "").toLowerCase();
    return p.includes("/reorder");
  }, [pathname]);

  const modeSegment = isReorderRoute ? "reorder" : "book";

  // slug state
  const [slug, setSlug] = React.useState<string>(slugFromRoute);

  // ✅ FIX 1: keep route slug and stored slug consistent
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const routeSlug = String(slugFromRoute || "").trim();
    let storedSlug = "";
    try {
      storedSlug =
        window.localStorage.getItem("service_slug") ||
        window.sessionStorage.getItem("service_slug") ||
        "";
    } catch {}

    const cleanedStored = String(storedSlug || "").trim();

    // If route slug exists and differs, route slug should win (prevents stale local slug)
    if (routeSlug && cleanedStored && cleanedStored !== routeSlug) {
      try {
        window.localStorage.setItem("service_slug", routeSlug);
        window.sessionStorage.setItem("service_slug", routeSlug);
      } catch {}
      setSlug(routeSlug);
      return;
    }

    // If stored exists, use it (matches route or route missing)
    if (cleanedStored) {
      setSlug(cleanedStored);
      return;
    }

    // Otherwise use route slug and store it
    if (routeSlug) {
      try {
        window.localStorage.setItem("service_slug", routeSlug);
        window.sessionStorage.setItem("service_slug", routeSlug);
      } catch {}
      setSlug(routeSlug);
    }
  }, [slugFromRoute]);

  const { user } = useAuth();
  const isLoggedIn = !!user;

  const router = useRouter();
  const searchParams = useSearchParams();

  const cart = useCart() as any;
  const cartItems: any[] = Array.isArray(cart?.items)
    ? cart.items
    : Array.isArray(cart?.state?.items)
    ? cart.state.items
    : [];

  const [clientCartReady, setClientCartReady] = React.useState(false);
  const [clientCartCount, setClientCartCount] = React.useState(0);

  React.useEffect(() => {
    setClientCartCount(cartItems.length);
    setClientCartReady(true);
  }, [cartItems.length]);

  const hasCartItems = clientCartReady && clientCartCount > 0;

  const [service, setService] = React.useState<ServiceDetail | null>(null);
  const [serviceLoading, setServiceLoading] = React.useState(true);

  /* ---------- Load service detail (by slug) & store ids locally ----- */

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!slug) return;
        setServiceLoading(true);

        const raw: any = await fetchServiceBySlug(slug);
        const s: any =
          (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) ??
          raw;

        if (cancelled) return;

        setService(s);

        // ✅ store service_id & slug
        try {
          if (typeof window !== "undefined" && s?._id) {
            const sid = String(s._id);
            window.localStorage.setItem("service_id", sid);
            window.sessionStorage.setItem("service_id", sid);
            window.localStorage.setItem("service_slug", slug);
            window.sessionStorage.setItem("service_slug", slug);
          }
        } catch {}

        // ✅ FIX 2: sync RAF form id from service assignments into localStorage
        try {
          const assignedRafFormId = extractAssignedRafFormId(s);
          if (assignedRafFormId) {
            const existing = safeGetLocal(RAF_FORM_ID_KEY(slug));

            // if changed, clear stale RAF caches so old schema/answers don't stick
            if (existing && existing !== assignedRafFormId) {
              clearRafCacheForSlug(slug);
              // optional: small notice (remove if you don't want)
              // toast.success("Medical questions have been updated. Please review your answers.");
            }

            window.localStorage.setItem(
              RAF_FORM_ID_KEY(slug),
              assignedRafFormId
            );
            window.sessionStorage.setItem(
              RAF_FORM_ID_KEY(slug),
              assignedRafFormId
            );
          }
        } catch {
          // ignore RAF sync errors
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

  /* ---------- Flow derived from service booking_flow / reorder_flow ---------- */

  const serviceDefinedFlow = React.useMemo<StepKey[]>(() => {
    const fallback = BASE_FLOW;

    const rawFlowJson = isReorderRoute
      ? (service as any)?.reorder_flow ?? (service as any)?.reorderFlow ?? null
      : (service as any)?.booking_flow ?? (service as any)?.bookingFlow ?? null;

    const parsed = parseServiceFlow(rawFlowJson);

    return parsed && parsed.length ? parsed : fallback;
  }, [service, isReorderRoute]);

  const flow = React.useMemo<StepKey[]>(
    () =>
      isLoggedIn
        ? serviceDefinedFlow.filter((s) => s !== "login")
        : serviceDefinedFlow,
    [isLoggedIn, serviceDefinedFlow]
  );

  const [currentStep, setCurrentStep] = React.useState<StepKey>("treatments");

  /* ---------- Restore current step from URL (?step=) or localStorage ------- */

  React.useEffect(() => {
    if (!slug) return;

    const rawFromQuery = (searchParams.get("step") || "") as StepKey;
    let step: StepKey | null = null;

    if (rawFromQuery && BASE_FLOW.includes(rawFromQuery)) {
      step = rawFromQuery;
    } else if (typeof window !== "undefined") {
      const persisted = window.localStorage.getItem(STEP_STORAGE_KEY(slug));
      if (persisted && BASE_FLOW.includes(persisted as StepKey)) {
        step = persisted as StepKey;
      }
    }

    if (!step) step = "treatments";

    if (isLoggedIn && step === "login") {
      const idxInBase = BASE_FLOW.indexOf("login");
      step = (BASE_FLOW[idxInBase + 1] ?? "treatments") as StepKey;
    }

    if (!isLoggedIn && step !== "treatments" && step !== "login") {
      step = "login";
    }

    if (!flow.includes(step)) {
      step = flow[0] ?? "treatments";
    }

    setCurrentStep((prev) => (prev === step ? prev : step));
  }, [slug, isLoggedIn, flow, searchParams]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug) return;
    try {
      window.localStorage.setItem(STEP_STORAGE_KEY(slug), currentStep);
    } catch {}
  }, [slug, currentStep]);

  const currentIndex = React.useMemo(() => {
    const idx = flow.indexOf(currentStep);
    return idx >= 0 ? idx : 0;
  }, [flow, currentStep]);

  const nextStep: StepKey | null =
    currentIndex < flow.length - 1 ? flow[currentIndex + 1] : null;
  const prevStep: StepKey | null =
    currentIndex > 0 ? flow[currentIndex - 1] : null;

  const goToStep = React.useCallback(
    (step: StepKey) => {
      if (!flow.includes(step)) return;

      setCurrentStep(step);

      try {
        const sp = new URLSearchParams(searchParams.toString());
        sp.set("step", step);
        const qs = sp.toString();
        const path = qs
          ? `/private-services/${encodeURIComponent(slug)}/${modeSegment}?${qs}`
          : `/private-services/${encodeURIComponent(slug)}/${modeSegment}`;

        router.replace(path, { scroll: false });
      } catch {}
    },
    [flow, router, searchParams, slug, modeSegment]
  );

  React.useEffect(() => {
    if (isLoggedIn && currentStep === "login") {
      const idxInBase = BASE_FLOW.indexOf("login");
      const afterLogin = (BASE_FLOW[idxInBase + 1] ?? "treatments") as StepKey;
      goToStep(
        flow.includes(afterLogin) ? afterLogin : flow[0] ?? "treatments"
      );
    }
  }, [isLoggedIn, currentStep, goToStep, flow]);

  React.useEffect(() => {
    if (!slug) return;
    if (currentStep === "success") {
      clearBookingStateForSlug(slug);
    }
  }, [slug, currentStep]);

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

  const handleNext = () => {
    if (!nextStep) return;

    const guard = canProceedFrom(currentStep);
    if (!guard.ok) {
      if (guard.message) toast.error(guard.message);
      return;
    }

    goToStep(nextStep);
  };

  const handlePrev = () => {
    if (!prevStep) return;
    goToStep(prevStep);
  };

  const maxClickableIndex = currentIndex;
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

  return (
    <main className="min-h-screen bg-pharmacy-bg py-6 md:py-10">
      <Container>
        <div className="mx-auto max-w-5xl">
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

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-soft-card md:p-6">
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
                      if (!disabled) goToStep(step);
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
                {clientCartReady && clientCartCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    {clientCartCount} item
                    {clientCartCount > 1 ? "s" : ""} in basket
                  </span>
                )}
              </div>
            </div>

            <div className="mt-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:p-4">
              {serviceLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-full rounded bg-slate-200" />
                  <div className="h-3 w-5/6 rounded bg-slate-200" />
                </div>
              ) : (
                <>
                  {currentStep === "treatments" && (
                    <TreatmentsStep serviceSlug={slug} />
                  )}
                  {currentStep === "login" && <LoginStep />}
                  {currentStep === "raf" && <RafStep />}
                  {currentStep === "calendar" && (
                    <CalendarStep serviceSlug={slug} />
                  )}
                  {currentStep === "payment" && (
                    <PaymentStep serviceSlug={slug} />
                  )}
                  {currentStep === "success" && (
                    <SuccessStep serviceSlug={slug} />
                  )}
                </>
              )}
            </div>

            {currentStep !== "success" && (
              <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-200 pt-3 text-xs md:flex-row md:items-center">
                <div className="text-[11px] text-slate-500">
                  Please complete each step carefully. You can&apos;t skip ahead
                  without finishing the current step.
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
