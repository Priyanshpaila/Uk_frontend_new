"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/cart/cart-context";
import {
  fetchScheduleForServiceSlug,
  buildSlotsForDate,
  dateToYmd,
  addDaysUtc,
  formatYmdForDisplay,
  type Schedule,
  type Slot,
  type DayMeta,
  persistAppointmentSelection,
  createAppointmentApi,
  createOrderApi,
  updateOrderApi,
  resolveUserIdFromStorage,
  type CreateAppointmentPayload,
  buildRafQAFromStorage,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveServiceId(
  schedule: Schedule | null,
  cartItems: CartItem[]
): string | null {
  if (!schedule) return null;

  const sch: any = schedule;

  const fromSchedule =
    sch.service_id ||
    sch.serviceId ||
    (sch.service && (sch.service._id || sch.service.id)) ||
    sch.service ||
    null;

  if (fromSchedule) return String(fromSchedule);

  for (const ci of cartItems as any[]) {
    const cid =
      ci.service_id ||
      ci.serviceId ||
      (ci.service && (ci.service._id || ci.service.id)) ||
      null;
    if (cid) return String(cid);
  }

  return null;
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

/** Read an ID from localStorage using a list of possible keys */
function readIdFromLocal(keys: string[]): string | null {
  if (typeof window === "undefined") return null;
  for (const key of keys) {
    try {
      const v = window.localStorage.getItem(key);
      if (v && v !== "undefined" && v !== "null") {
        return v;
      }
    } catch {}
  }
  return null;
}

function readRafFormId(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `raf_form_id.${slug}`;
    const v = localStorage.getItem(key);
    if (v && v !== "undefined" && v !== "null") {
      return v;
    }
  } catch {}
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
  const rafQA = buildRafQAFromStorage(opts.serviceSlug);
  const rafFormId = readRafFormId(opts.serviceSlug);

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
      raf: {
        form_id: rafFormId || null,
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

/* ------------------------------------------------------------------ */
/* Calendar component                                                 */
/* ------------------------------------------------------------------ */

export default function CalendarBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const router = useRouter();
  const cart = useCart();
  const cartItems: CartItem[] = Array.isArray((cart as any)?.items)
    ? (cart as any).items
    : Array.isArray((cart as any)?.state?.items)
    ? (cart as any).state.items
    : [];

  const [date, setDate] = useState<string>(() => dateToYmd(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [dayMeta, setDayMeta] = useState<DayMeta | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);

  // ✅ NEW: success message + duplicate guard
  const [appointmentSuccess, setAppointmentSuccess] = useState<string | null>(
    null
  );
  const [hasCreatedAppointment, setHasCreatedAppointment] = useState(false);

  const minDate = useMemo(() => dateToYmd(new Date()), []);
  const maxDate = useMemo(() => dateToYmd(addDaysUtc(new Date(), 180)), []);

  const handleDateChange = (e: any) => {
    let value = e.target.value as string;
    if (!value) return;

    if (value < minDate) value = minDate;
    if (value > maxDate) value = maxDate;

    setDate(value);
  };

  // Persist service slug for other flows
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem("service_slug", slug);
      sessionStorage.setItem("service_slug", slug);
    } catch {}
  }, [slug]);

  // 1) Load schedule for this service slug
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Missing service slug; cannot load schedule.");
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const sch = await fetchScheduleForServiceSlug(slug);
        if (cancelled) return;

        setSchedule(sch);
        setScheduleId(sch._id || null);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load schedule.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // 2) Build slots when schedule or date changes
  useEffect(() => {
    if (!schedule) {
      setSlots([]);
      setDayMeta(null);
      setSelectedIso(null);
      return;
    }

    const { slots: built, meta } = buildSlotsForDate(schedule, date);
    setSlots(built);
    setDayMeta(meta);
    setSelectedIso(null);
    setAppointmentError(null);
    setAppointmentSuccess(null);
    setHasCreatedAppointment(false);
  }, [schedule, date]);

  // ✅ NEW: whenever user selects a slot, check if we've already created
  // an appointment for this slug + datetime (stored in localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug || !selectedIso) {
      setHasCreatedAppointment(false);
      return;
    }
    const key = `appointment_created.${slug}.${selectedIso}`;
    try {
      const v = localStorage.getItem(key);
      setHasCreatedAppointment(v === "1");
    } catch {
      setHasCreatedAppointment(false);
    }
  }, [slug, selectedIso]);

  // ---- Calendar helpers ----

  function shiftDay(delta: number) {
    setDate((prev) => {
      const d = new Date(prev + "T00:00:00");
      d.setDate(d.getDate() + delta);
      const next = dateToYmd(d);

      if (next < minDate) return prev;
      if (next > maxDate) return prev;

      return next;
    });
  }

  const atStart = date <= minDate;
  const hasSlots = slots.length > 0;
  const closedForDay =
    !loading && !!dayMeta && dayMeta.open === false && !hasSlots;

  function handleSelect(iso: string, label?: string) {
    setSelectedIso(iso);
    setAppointmentError(null);
    setAppointmentSuccess(null);
    persistAppointmentSelection(iso, {
      label,
      serviceSlug: slug,
    });
  }

  // ---- Order + Appointment creation ----

  async function handleContinue() {
    setAppointmentError(null);
    setAppointmentSuccess(null);

    if (!selectedIso) {
      setAppointmentError("Please select an appointment time first.");
      return;
    }
    if (!schedule) {
      setAppointmentError("No schedule found for this service.");
      return;
    }
    if (!cartItems.length) {
      setAppointmentError(
        "Your basket is empty. Please add at least one treatment before booking."
      );
      return;
    }

    // If we already created an appointment for this exact slot, block duplicates
    if (hasCreatedAppointment) {
      setAppointmentError(
        "An appointment has already been created for this time."
      );
      return;
    }

    const userIdFromLocal = readIdFromLocal([
      "user_id",
      "pe_user_id",
      "userId",
      "patient_id",
    ]);
    const userId = userIdFromLocal || resolveUserIdFromStorage();

    if (!userId) {
      setAppointmentError("You need to be logged in to book an appointment.");
      return;
    }

    const serviceIdFromLocal = readIdFromLocal([
      "service_id",
      "pe_service_id",
      "serviceId",
    ]);
    const serviceId =
      serviceIdFromLocal || resolveServiceId(schedule, cartItems);

    if (!serviceId) {
      setAppointmentError(
        "Missing service information for this booking. Please start again from the service page."
      );
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "No service_id found in localStorage or schedule/cart. schedule:",
          schedule
        );
      }
      return;
    }

    const scheduleIdFromLocal = readIdFromLocal([
      "schedule_id",
      "pe_schedule_id",
      "scheduleId",
    ]);
    const effectiveScheduleId =
      scheduleIdFromLocal || (scheduleId ? String(scheduleId) : null);

    if (!effectiveScheduleId) {
      setAppointmentError(
        "Missing schedule information for this booking. Please start again from the service page."
      );
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "No schedule_id found in localStorage or state. schedule:",
          schedule
        );
      }
      return;
    }

    const startDate = new Date(selectedIso);
    if (Number.isNaN(startDate.getTime())) {
      setAppointmentError("Invalid appointment time selected.");
      return;
    }

    const slotMinutes = schedule.slot_minutes || 15;
    const endDate = new Date(startDate.getTime() + slotMinutes * 60_000);
    const endIso = endDate.toISOString();

    const meta = buildOrderMeta({
      cartItems,
      serviceSlug: slug,
      serviceName: schedule.name,
      appointmentIso: selectedIso,
    });

    const orderPayload: any = {
      user_id: String(userId),
      service_id: String(serviceId),
      schedule_id: String(effectiveScheduleId),
      start_at: selectedIso,
      end_at: endIso,
      meta,
      payment_status: "pending",
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("Creating order with payload:", orderPayload);
    }

    setCreatingAppointment(true);
    try {
      // 1) Create order
      const order = await createOrderApi(orderPayload);
      const orderId = order && (order._id || null);

      if (!orderId) {
        throw new Error("Order was created but no id was returned.");
      }

      try {
        localStorage.setItem("order_id", String(orderId));
      } catch {}

      // 2) Create appointment linked to this order
      const appointmentPayload: CreateAppointmentPayload = {
        order_id: String(orderId),
        user_id: String(userId),
        service_id: String(serviceId),
        schedule_id: String(effectiveScheduleId),
        start_at: selectedIso,
        end_at: endIso,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("Creating appointment with payload:", appointmentPayload);
      }

      const appointment = await createAppointmentApi(appointmentPayload);

      const appointmentId =
        (appointment && (appointment._id || appointment.id)) || null;
      const appointmentStart =
        appointment?.start_at || appointment?.startAt || selectedIso;

      // Mark order as having an appointment booked
      try {
        await updateOrderApi(String(orderId), {
          is_appointment_booked: true,
        } as any);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error(
            "Failed to update order is_appointment_booked flag:",
            err
          );
        }
      }

      try {
        if (appointmentId)
          localStorage.setItem("appointment_id", String(appointmentId));
        if (appointmentStart)
          localStorage.setItem(
            "appointment_start_at",
            String(appointmentStart)
          );

        // ✅ store "created" flag for this exact slot to prevent duplicate entries
        const key = `appointment_created.${slug}.${appointmentStart}`;
        localStorage.setItem(key, "1");
        setHasCreatedAppointment(true);
      } catch {}

      // ✅ show success message
      setAppointmentSuccess(
        "Appointment booked successfully. Redirecting to payment…"
      );

      const qp = new URLSearchParams();
      qp.set("step", "payment");
      qp.set("appointment_at", appointmentStart);
      qp.set("service_slug", slug);
      if (orderId) qp.set("order", String(orderId));

      router.push(
        `/private-services/${encodeURIComponent(slug)}/book?${qp.toString()}`
      );
    } catch (e: any) {
      setAppointmentError(e?.message || "Failed to create booking.");
    } finally {
      setCreatingAppointment(false);
    }
  }

  const isToday = date === minDate;

  return (
    <main className="min-h-screen bg-pharmacy-bg py-6 md:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white/95 p-6 md:p-8 shadow-soft-card">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900 md:text-3xl">
              Choose an appointment
            </h1>
            {schedule && (
              <p className="mt-2 text-xs text-gray-500">
                {schedule.name} • Times shown in{" "}
                <span className="font-medium">
                  {schedule.timezone || "local time"}
                </span>{" "}
                • {schedule.slot_minutes}
                -minute slots
              </p>
            )}
            {scheduleId && (
              <p className="mt-1 text-[11px] text-gray-400">
                Schedule ID: {scheduleId}
              </p>
            )}
          </div>

          {/* Date controls */}
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1">
              <button
                type="button"
                onClick={() => !atStart && shiftDay(-1)}
                disabled={atStart}
                aria-disabled={atStart}
                className={`rounded-full border px-3 py-1 text-xs md:text-sm ${
                  atStart
                    ? "opacity-40 cursor-not-allowed border-gray-200"
                    : "hover:bg-gray-100 border-gray-200"
                }`}
                aria-label="Previous day"
                title={atStart ? undefined : "Previous day"}
              >
                ‹
              </button>
              <div className="min-w-[8rem] text-center text-xs md:text-sm font-medium text-gray-700">
                {formatYmdForDisplay(date)}
              </div>
              {isToday && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                  Today
                </span>
              )}
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs md:text-sm hover:bg-gray-100"
                aria-label="Next day"
                title="Next day"
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="date-picker"
                className="text-[11px] text-gray-500"
              >
                Jump to date:
              </label>
              <input
                id="date-picker"
                type="date"
                value={date}
                min={minDate}
                max={maxDate}
                onChange={handleDateChange}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs md:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Select an available time below, then continue to payment to confirm
          your booking.
        </p>

        {/* Override / status banner */}
        {dayMeta?.hasOverride && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Special hours for this date
            {dayMeta.start && dayMeta.end
              ? `: ${dayMeta.start}–${dayMeta.end}`
              : ""}
            {dayMeta.overrideNote ? ` • ${dayMeta.overrideNote}` : ""}
          </div>
        )}

        {closedForDay && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {dayMeta.reason || "We are closed on this date."}
          </div>
        )}

        {appointmentError && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {appointmentError}
          </div>
        )}

        {/* ✅ Success banner */}
        {appointmentSuccess && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            {appointmentSuccess}
          </div>
        )}

        {/* Slots */}
        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-500">Loading schedule…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">
              Failed to load schedule: {error}
            </div>
          ) : !schedule ? (
            <div className="text-sm text-gray-500">
              No schedule found for this service.
            </div>
          ) : !hasSlots ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500 text-center">
              No slots available for this date. Try another day.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 mt-2">
              {slots.map((s) => {
                const isSelected = selectedIso === s.start_at;
                const isDisabled = !s.available || s.remaining <= 0;
                return (
                  <button
                    key={s.start_at}
                    type="button"
                    onClick={() =>
                      !isDisabled && handleSelect(s.start_at, s.time)
                    }
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    className={`px-3 py-2 rounded-xl border text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                      isSelected
                        ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    } ${
                      isDisabled
                        ? "opacity-60 cursor-not-allowed bg-gray-50 text-gray-400 border-gray-200"
                        : "cursor-pointer"
                    }`}
                    title={
                      isDisabled
                        ? "This time is not available"
                        : "Select this time"
                    }
                  >
                    <div className="font-medium p-3">{s.time}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer / CTA */}
        {!loading && !error && schedule && hasSlots && (
          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-gray-100 pt-4 sm:flex-row sm:items-center">
            <div className="text-xs text-gray-500">
              {selectedIso ? (
                <>
                  Selected time:{" "}
                  <span className="font-semibold text-gray-800">
                    {new Date(selectedIso).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {hasCreatedAppointment && (
                    <span className="ml-2 text-emerald-600 font-medium">
                      • Appointment already created for this time
                    </span>
                  )}
                </>
              ) : (
                "No time selected yet."
              )}
            </div>
            <button
              type="button"
              onClick={handleContinue}
              disabled={
                creatingAppointment || !selectedIso || hasCreatedAppointment
              }
              className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm ${
                creatingAppointment || !selectedIso || hasCreatedAppointment
                  ? "bg-emerald-300 cursor-not-allowed opacity-80"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {creatingAppointment
                ? "Booking…"
                : hasCreatedAppointment
                ? "Appointment created"
                : "Book appointment"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
