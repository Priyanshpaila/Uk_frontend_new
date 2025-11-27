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
  getBackendBase,
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
 * - Clears appointment selection
 * - Clears order ids/references/last body
 * - Clears schedule_id + booking_next / booking_slug
 * - Clears consultation session id + raf section index
 * - DOES NOT clear raf_answers so user can re-use previous answers.
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
    "order_reference",
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
/*                               HELPER UTILS                                 */
/* -------------------------------------------------------------------------- */

function safeJsonParse<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readSelectedIsoFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = [
      "appointment_at",
      "selected_appointment_at",
      "booking_at",
      "calendar_selected_at",
    ];
    for (const k of keys) {
      const v = sessionStorage.getItem(k) || localStorage.getItem(k);
      if (v) return v;
    }
  } catch {}
  return null;
}

function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem("pharmacy_user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("user_data") ||
      localStorage.getItem("pe_user") ||
      localStorage.getItem("pe.user");
    const parsed = safeJsonParse<any>(raw);
    if (!parsed) return null;
    return parsed._id || parsed.userId || parsed.id || null;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const pairs = document.cookie.split("; ");
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const key = decodeURIComponent(pair.slice(0, eq));
    if (key === name) {
      return decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return null;
}

function getConsultationSessionId(): number | null {
  if (typeof window === "undefined") return null;
  const keys = [
    "consultation_session_id",
    "pe_consultation_session_id",
    "consultationSessionId",
  ];
  for (const k of keys) {
    try {
      const raw =
        localStorage.getItem(k) ||
        sessionStorage.getItem(k) ||
        readCookie(k) ||
        null;
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return n;
    } catch {}
  }
  return null;
}

function readRafAnswers(slug: string): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = [
      `raf_answers.${slug}`,
      `raf.answers.${slug}`,
      `assessment.answers.${slug}`,
    ];
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch {}
  return null;
}

function formatAnswer(v: any): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(formatAnswer).join(", ");
  if (typeof v === "object") {
    if ("label" in v) return String((v as any).label);
    if ("value" in v) return String((v as any).value);
    return JSON.stringify(v);
  }
  return String(v);
}

function buildRafQA(slug: string): any[] {
  const answers = readRafAnswers(slug);
  if (!answers) return [];
  return Object.entries(answers).map(([key, raw], index) => ({
    key,
    question: `Question ${index + 1}`,
    answer: formatAnswer(raw),
    raw,
  }));
}

type SimpleSchedule = {
  _id: string;
  name: string;
  service_id: string;
  service_slug: string;
  slot_minutes?: number;
};

// Try to load schedule for this service (by stored id or by slug)
async function loadScheduleForOrder(
  serviceSlug: string
): Promise<SimpleSchedule | null> {
  const base = getBackendBase(); // e.g. http://localhost:8000/api

  // 1) If we have schedule_id stored from CalendarStep, try that first.
  let storedId: string | null = null;
  try {
    storedId =
      (typeof window !== "undefined" &&
        (localStorage.getItem("schedule_id") ||
          sessionStorage.getItem("schedule_id"))) ||
      null;
  } catch {
    storedId = null;
  }

  if (storedId) {
    try {
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("session_token")
          : null;

      const res = await fetch(`${base}/schedules/${storedId}`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const sch = (await res.json()) as SimpleSchedule;
        if (sch && sch._id) return sch;
      }
    } catch {
      // ignore and fall back to list
    }
  }

  // 2) Fallback: list all schedules and find by service_slug
  try {
    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("session_token")
        : null;

    const res = await fetch(`${base}/schedules`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return null;
    const json = await res.json();
    let list: SimpleSchedule[] = [];
    if (Array.isArray((json as any)?.data)) {
      list = (json as any).data;
    } else if (Array.isArray(json)) {
      list = json;
    }
    const match =
      list.find((s) => s.service_slug === serviceSlug) || list[0] || null;
    return match || null;
  } catch {
    return null;
  }
}

function buildOrderMeta(opts: {
  cartItems: any[];
  serviceSlug: string;
  serviceName?: string;
  appointmentIso: string;
}) {
  const items = (opts.cartItems || []).map((ci: any) => {
    const unitMinor =
      typeof ci.unitMinor === "number"
        ? ci.unitMinor
        : ci.price
        ? Math.round(Number(ci.price) * 100)
        : 0;
    const qty = Number(ci.qty || 1);
    const totalMinor =
      typeof ci.totalMinor === "number" ? ci.totalMinor : unitMinor * qty;

    const variation =
      ci.variation ||
      ci.variations ||
      ci.optionLabel ||
      ci.selectedLabel ||
      ci.label ||
      "";

    return {
      sku: ci.sku,
      name: ci.name,
      variations: variation || null,
      strength: ci.strength ?? null,
      qty,
      unitMinor,
      totalMinor,
      variation: variation || null,
    };
  });

  const lines = items.map((it: any, index: number) => ({
    index,
    name: it.name,
    qty: it.qty,
    variation: it.variation || it.variations || "",
  }));

  const totalMinor = items.reduce(
    (sum: number, it: any) => sum + (it.totalMinor || 0),
    0
  );

  const sessionId = getConsultationSessionId();
  const rafQA = buildRafQA(opts.serviceSlug);

  const meta: any = {
    type: "new",
    lines,
    items,
    totalMinor,
    service_slug: opts.serviceSlug,
    service: opts.serviceName || opts.serviceSlug,
    appointment_start_at: opts.appointmentIso,
    consultation_session_id: sessionId ?? undefined,
    payment_status: "pending",
    formsQA: {
      risk_assessment: {
        form_id: null,
        schema_version: null,
        qa: [],
      },
      assessment: {
        form_id: null,
        schema_version: null,
        qa: [],
      },
      raf: {
        form_id: null,
        schema_version: null,
        qa: rafQA,
      },
    },
  };

  if (items[0]) {
    const first = items[0];
    meta.selectedProduct = {
      name: first.name,
      variation: first.variation || first.variations || null,
      strength: first.strength || first.variation || null,
      qty: first.qty,
      unitMinor: first.unitMinor,
      totalMinor: first.totalMinor,
    };
  }

  return meta;
}

// Create ISO end_at by adding slotMinutes to start_at
function computeEndIso(startIso: string, slotMinutes?: number): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return startIso;
  const mins =
    Number.isFinite(slotMinutes || 0) && (slotMinutes || 0) > 0
      ? (slotMinutes as number)
      : 15;
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

/* -------------------------------------------------------------------------- */
/*                               MAIN PAGE                                    */
/* -------------------------------------------------------------------------- */

export default function BookServicePage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const { user } = useAuth();
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

  // 🔄 Restore current step from localStorage when page loads
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

      // If user is logged in, skip "login" step
      if (step === "login" && isLoggedIn) {
        const idxInBase = BASE_FLOW.indexOf("login");
        step = (BASE_FLOW[idxInBase + 1] ?? "treatments") as StepKey;
      }

      // Ensure this step exists in the current flow
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

  // Order creation flags
  const [creatingOrder, setCreatingOrder] = React.useState(false);
  const [orderCreated, setOrderCreated] = React.useState(false);

  /* ---------- Load service detail ---------- */

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setServiceLoading(true);
        const s = await fetchServiceBySlug(slug);
        if (!cancelled) setService(s);
      } catch (e) {
        console.error("Failed to load service detail", e);
      } finally {
        if (!cancelled) setServiceLoading(false);
      }
    }

    if (slug) load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

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


  /* ---------- Guards & order creation ---------- */

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

  async function createOrderIfNeeded(): Promise<{
    ok: boolean;
    message?: string;
  }> {
    if (orderCreated) return { ok: true };

    const startIso = readSelectedIsoFromStorage();
    if (!startIso) {
      return { ok: false, message: "Pick an appointment time first." };
    }

    const authUserId = (user as any)?._id as string | undefined;
    const userId = authUserId ?? getCurrentUserId();
    if (!userId) {
      return {
        ok: false,
        message: "Could not determine your user. Please log in again.",
      };
    }

    if (!hasCartItems) {
      return {
        ok: false,
        message: "Your basket is empty. Please add at least one item.",
      };
    }

    try {
      const schedule = await loadScheduleForOrder(slug);
      if (!schedule) {
        return {
          ok: false,
          message: "No schedule configured for this service.",
        };
      }

      const scheduleId = schedule._id;
      const serviceId = schedule.service_id;
      const slotMinutes = schedule.slot_minutes ?? 15;
      const endIso = computeEndIso(startIso, slotMinutes);

      const now = new Date();
      const ref = `ORD-${now.getFullYear()}-${now
        .getTime()
        .toString(36)
        .toUpperCase()}`;

      const meta = buildOrderMeta({
        cartItems,
        serviceSlug: slug,
        serviceName: schedule.name,
        appointmentIso: startIso,
      });

      const base = getBackendBase();
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("session_token")
          : null;

      const body: any = {
        user_id: userId,
        schedule_id: scheduleId,
        service_id: serviceId,
        reference: ref,
        start_at: startIso,
        end_at: endIso,
        meta,
        payment_status: "pending",
      };

      const res = await fetch(`${base}/orders`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => "");
      if (!res.ok) {
        let msg = text;
        try {
          const j = JSON.parse(text);
          msg = j?.message || msg;
        } catch {}
        return {
          ok: false,
          message:
            msg ||
            `Failed to create order (HTTP ${res.status}). Check required fields on the backend.`,
        };
      }

      let order: any = null;
      try {
        order = text ? JSON.parse(text) : null;
      } catch {
        order = null;
      }

      try {
        if (order?._id) {
          localStorage.setItem("order_id", String(order._id));
          sessionStorage.setItem("order_id", String(order._id));
        }
        if (order?.reference || ref) {
          const finalRef = order?.reference || ref;
          localStorage.setItem("order_reference", String(finalRef));
          sessionStorage.setItem("order_reference", String(finalRef));
        }
      } catch {}

      setOrderCreated(true);
      return { ok: true };
    } catch (e: any) {
      return {
        ok: false,
        message: e?.message || "Network error while creating order.",
      };
    }
  }

  /* ---------- Navigation handlers ---------- */

  const handleNext = async () => {
    if (!nextStep) return;

    const guard = canProceedFrom(currentStep);
    if (!guard.ok) {
      if (guard.message) toast.error(guard.message);
      return;
    }

    if (currentStep === "calendar") {
      setCreatingOrder(true);
      const { ok, message } = await createOrderIfNeeded();
      setCreatingOrder(false);

      if (!ok) {
        toast.error(
          message || "Could not create your order. Please try again."
        );
        return;
      }

      toast.success("Your appointment has been reserved.");
    }

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
    (currentStep === "login" && !isLoggedIn) ||
    creatingOrder;

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
                    {creatingOrder ? "Booking…" : `${nextButtonLabel} →`}
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
