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
  fetchBookedSlotsApi,
  type BookedSlotsResponse,
  getLoggedInUserApi,
  type LoggedInUser,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

export type CalendarStepProps = {
  serviceSlug?: string;
  autoContinue?: boolean; // kept for compatibility with parent
  goToPaymentStep?: () => void; // called after successful booking
};

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

function minorToMajor(minor: number): number {
  const n = Number(minor || 0);
  return Math.round((n / 100) * 100) / 100;
}

function resolveShippingFromUser(user: LoggedInUser | null) {
  const u: any = user || {};
  const shipLine1 =
    (u.shipping_address_line1 || u.shippingAddressLine1 || "").trim();
  const shipCity = (u.shipping_city || u.shippingCity || "").trim();
  const shipPost = (u.shipping_postalcode || u.shippingPostalcode || "").trim();

  const hasShipping =
    !!shipLine1 || !!shipCity || !!shipPost || !!u.shipping_country;

  const shipping = {
    shipping_address_line1: hasShipping
      ? shipLine1
      : (u.address_line1 || "").trim(),
    shipping_address_line2: hasShipping
      ? (u.shipping_address_line2 || u.shippingAddressLine2 || "").trim()
      : (u.address_line2 || "").trim(),
    shipping_city: hasShipping
      ? (u.shipping_city || u.shippingCity || "").trim()
      : (u.city || "").trim(),
    shipping_county: hasShipping
      ? (u.shipping_county || u.shippingCounty || "").trim()
      : (u.county || "").trim(),
    shipping_postalcode: hasShipping
      ? (u.shipping_postalcode || u.shippingPostalcode || "").trim()
      : (u.postalcode || "").trim(),
    shipping_country: hasShipping
      ? (u.shipping_country || u.shippingCountry || "").trim()
      : (u.country || "UK").trim(),
    shipping_is_different: hasShipping,
  };

  return shipping;
}

function buildOrderMeta(opts: {
  cartItems: any[];
  serviceSlug: string;
  serviceName?: string;
  appointmentIso: string;
  user?: LoggedInUser | null;
  currency?: string;
}) {
  const currency = (opts.currency || "GBP").toUpperCase();

  const items = (opts.cartItems || []).map((ci: any) => {
    const qty = Math.max(1, Number(ci.qty || 1));

    const unitMinor =
      typeof ci.unitMinor === "number"
        ? ci.unitMinor
        : typeof ci.priceMinor === "number"
        ? ci.priceMinor
        : ci.price
        ? Math.round(Number(ci.price) * 100)
        : 0;

    const totalMinor =
      typeof ci.totalMinor === "number" ? ci.totalMinor : unitMinor * qty;

    const price = minorToMajor(unitMinor);
    const line_total = minorToMajor(totalMinor);

    const variation =
      ci.variation ||
      ci.variations ||
      ci.optionLabel ||
      ci.selectedLabel ||
      ci.label ||
      "";

    return {
      sku: ci.sku || undefined,
      name: ci.name,
      variations: variation || null,
      strength: ci.strength ?? null,
      qty,
      unitMinor,
      totalMinor,
      price,
      line_total,
      variation: variation || null,
    };
  });

  const lines = items.map((it: any, index: number) => ({
    index,
    name: it.name,
    qty: it.qty,
    variation: it.variation || it.variations || null,

    // ✅ add pricing on each line (minor + major)
    unitMinor: it.unitMinor,
    totalMinor: it.totalMinor,
    price: it.price,
    line_total: it.line_total,

    sku: it.sku,
  }));

  const subtotalMinor = items.reduce(
    (sum: number, it: any) => sum + (it.totalMinor || 0),
    0
  );
  const feesMinor = 0;
  const totalMinor = subtotalMinor + feesMinor;

  const subtotal = minorToMajor(subtotalMinor);
  const fees = minorToMajor(feesMinor);
  const total = minorToMajor(totalMinor);

  const sessionId = getConsultationSessionId();
  const rafQA = buildRafQAFromStorage(opts.serviceSlug);
  const rafFormId = readRafFormId(opts.serviceSlug);

  const shipping = resolveShippingFromUser(opts.user ?? null);

  const meta: any = {
    type: "new",

    // ✅ pricing (canonical minor + ready-to-display major)
    lines,
    items,
    subtotalMinor,
    feesMinor,
    totalMinor,
    subtotal,
    fees,
    total,
    currency,

    // ✅ order context
    service_slug: opts.serviceSlug,
    service: opts.serviceName || opts.serviceSlug,
    appointment_start_at: opts.appointmentIso,
    consultation_session_id: sessionId ?? undefined,
    payment_status: "pending",

    // ✅ shipping address snapshot on order
    ...shipping,

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
      price: first.price,
      line_total: first.line_total,
      currency,
    };
  }

  return meta;
}

/* ------------------------------------------------------------------ */
/* Calendar component                                                 */
/* ------------------------------------------------------------------ */

export default function CalendarStep({
  serviceSlug,
  autoContinue, // not used currently, but kept for compatibility
  goToPaymentStep,
}: CalendarStepProps) {
  const params = useParams<{ slug: string }>();
  const slug = serviceSlug || params?.slug || "";

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

  // success message + duplicate guard
  const [appointmentSuccess, setAppointmentSuccess] = useState<string | null>(
    null
  );
  const [hasCreatedAppointment, setHasCreatedAppointment] = useState(false);

  // booked slots from backend for selected date
  const [bookedSlots, setBookedSlots] = useState<BookedSlotsResponse | null>(
    null
  );

  const minDate = useMemo(() => dateToYmd(new Date()), []);
  const maxDate = useMemo(() => dateToYmd(addDaysUtc(new Date(), 180)), []);

  const handleDateChange = (e: any) => {
    let value = e.target.value as string;
    if (!value) return;

    if (value < minDate) value = minDate;
    if (value > maxDate) value = maxDate;

    setDate(value);
  };

  // Build a service-specific view of the schedule so that overrides
  // only apply to this service (by slug / service_id)
  const effectiveSchedule: Schedule | null = useMemo(() => {
    if (!schedule) return null;

    const sch: any = schedule;
    const currentServiceId = resolveServiceId(schedule, cartItems);

    const rawOverrides = Array.isArray(sch.overrides) ? sch.overrides : null;
    if (!rawOverrides) {
      return schedule;
    }

    const filteredOverrides = rawOverrides.filter((ov: any) => {
      if (!ov || typeof ov !== "object") return false;

      const ovServiceId =
        ov.service_id ||
        ov.serviceId ||
        (ov.service && (ov.service._id || ov.service.id)) ||
        null;

      const ovSlug = ov.service_slug || ov.serviceSlug || null;

      if (ovSlug && ovSlug !== slug) return false;

      if (ovServiceId && currentServiceId) {
        if (String(ovServiceId) !== String(currentServiceId)) return false;
      }

      return true;
    });

    if (!filteredOverrides.length) {
      return { ...(schedule as any), overrides: [] } as Schedule;
    }

    return { ...(schedule as any), overrides: filteredOverrides } as Schedule;
  }, [schedule, cartItems, slug]);

  const handleSelect = (iso: string, label?: string) => {
    setSelectedIso(iso);
    setAppointmentError(null);
    setAppointmentSuccess(null);
    persistAppointmentSelection(iso, {
      label,
      serviceSlug: slug,
    });
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

  // 2) Build base slots (opening hours) when *service-specific* schedule or date changes
  useEffect(() => {
    if (!effectiveSchedule) {
      setSlots([]);
      setDayMeta(null);
      setSelectedIso(null);
      return;
    }

    const { slots: built, meta } = buildSlotsForDate(effectiveSchedule, date);
    setSlots(built);
    setDayMeta(meta);
    setSelectedIso(null);
    setAppointmentError(null);
    setAppointmentSuccess(null);
    setHasCreatedAppointment(false);
  }, [effectiveSchedule, date]);

  // 3) Fetch booked slots for this schedule + date
  useEffect(() => {
    if (!scheduleId || !date) {
      setBookedSlots(null);
      return;
    }

    let cancelled = false;

    async function run() {
      try {
        const data = await fetchBookedSlotsApi(String(scheduleId), date);
        if (cancelled) return;
        setBookedSlots(data);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load booked slots", err);
        }
        if (!cancelled) {
          setBookedSlots(null);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [scheduleId, date]);

  // Whenever user selects a slot, check if we've already created
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

    // ✅ fetch user profile once so we can snapshot shipping address into order meta
    let userProfile: LoggedInUser | null = null;
    try {
      userProfile = await getLoggedInUserApi();
    } catch {
      userProfile = null; // continue without blocking
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
      return;
    }

    const startDate = new Date(selectedIso);
    if (Number.isNaN(startDate.getTime())) {
      setAppointmentError("Invalid appointment time selected.");
      return;
    }

    const slotMinutes = (schedule as any).slot_minutes || 15;
    const endDate = new Date(startDate.getTime() + slotMinutes * 60_000);
    const endIso = endDate.toISOString();

    // ✅ meta now includes:
    // - price + line_total on each line
    // - subtotal/total in both minor & major
    // - shipping address snapshot (uses user's shipping if present)
    const meta = buildOrderMeta({
      cartItems,
      serviceSlug: slug,
      serviceName: (schedule as any).name,
      appointmentIso: selectedIso,
      user: userProfile,
      currency: "GBP",
    });

    const orderPayload: any = {
      user_id: String(userId),
      service_id: String(serviceId),
      schedule_id: String(effectiveScheduleId),
      start_at: selectedIso,
      end_at: endIso,
      meta,
      payment_status: "pending",
      order_type: "new",
    };

    setCreatingAppointment(true);
    try {
      // 1) Create order (with price + totals + shipping in meta)
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

      const appointment = await createAppointmentApi(appointmentPayload);

      const appointmentId =
        (appointment && ((appointment as any)._id || (appointment as any).id)) ||
        null;
      const appointmentStart =
        (appointment as any)?.start_at ||
        (appointment as any)?.startAt ||
        selectedIso;

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

        const key = `appointment_created.${slug}.${appointmentStart}`;
        localStorage.setItem(key, "1");
        setHasCreatedAppointment(true);
      } catch {}

      setAppointmentSuccess(
        "Appointment booked successfully. Redirecting to payment…"
      );

      if (goToPaymentStep) {
        goToPaymentStep();
        return;
      }

      const qp = new URLSearchParams();
      if (appointmentStart) qp.set("appointment_at", appointmentStart);
      qp.set("service_slug", slug);
      if (orderId) qp.set("order", String(orderId));
      qp.set("step", "payment");

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
    <div className="w-full">
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white/95 p-6 md:p-8 shadow-soft-card">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900 md:text-3xl">
              Choose an appointment
            </h1>
            {schedule && (
              <p className="mt-2 text-xs text-gray-500">
                {(schedule as any).name} • Times shown in{" "}
                <span className="font-medium">
                  {(schedule as any).timezone || "local time"}
                </span>{" "}
                • {(schedule as any).slot_minutes}
                -minute slots
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

                const bookedForTime =
                  bookedSlots?.slots?.find((b) => b.time === s.time) || null;

                const isFullFromApi =
                  !!bookedForTime &&
                  (bookedForTime.is_full ||
                    (typeof bookedForTime.count === "number" &&
                      typeof bookedSlots?.capacity === "number" &&
                      bookedForTime.count >= bookedSlots.capacity));

                const isDisabled =
                  !s.available || s.remaining <= 0 || isFullFromApi;

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
                    <div className="font-medium p-3">
                      {s.time}
                      {isFullFromApi && (
                        <span className="ml-1 text-[10px] text-rose-500">
                          (Full)
                        </span>
                      )}
                    </div>
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
    </div>
  );
}
