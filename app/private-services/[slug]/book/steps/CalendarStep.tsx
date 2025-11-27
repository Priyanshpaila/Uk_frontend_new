"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import {
  fetchScheduleForServiceSlug,
  buildSlotsForDate,
  dateToYmd,
  addDaysUtc,
  formatYmdForDisplay,
  type Schedule,
  type Slot,
  type DayMeta,
  getLoggedInUserApi,
  type LoggedInUser,
  buildRafQAFromStorage,
  getConsultationSessionIdFromStorage,
  resolveUserIdFromStorage,
  getStoredUserFromStorage,
  persistAppointmentSelection,
  createOrderApi,
  type CreateOrderPayload,
} from "@/lib/api";

function generateReference(): string {
  const now = new Date();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${now.getFullYear()}-${random}`;
}

export default function CalendarBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const router = useRouter();
  const cart = useCart() as any;

  const cartItems: any[] = Array.isArray(cart?.items)
    ? cart.items
    : Array.isArray(cart?.state?.items)
    ? cart.state.items
    : [];

  const [date, setDate] = useState<string>(() => dateToYmd(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [dayMeta, setDayMeta] = useState<DayMeta | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<LoggedInUser | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const minDate = useMemo(() => dateToYmd(new Date()), []);
  const maxDate = useMemo(
    () => dateToYmd(addDaysUtc(new Date(), 180)),
    []
  );

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

  // 2) Load current logged-in user (for meta)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const user = await getLoggedInUserApi();
        if (!cancelled) setCurrentUser(user);
      } catch {
        // not logged in or /me failed; ignore
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // 3) Build slots when schedule or date changes
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
  }, [schedule, date]);

  // ---- Calendar helpers ----

  function shiftDay(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = dateToYmd(d);
    if (next < minDate || next > maxDate) return;
    setDate(next);
  }

  const atStart = date <= minDate;
  const hasSlots = slots.length > 0;
  const closedForDay =
    !loading && !!dayMeta && dayMeta.open === false && !hasSlots;

  function handleSelect(iso: string, label?: string) {
    setSelectedIso(iso);
    persistAppointmentSelection(iso, {
      label,
      serviceSlug: slug,
    });
  }

  // ---- Order creation ----

  async function handleContinue() {
    setOrderError(null);

    if (!selectedIso) {
      setOrderError("Please select an appointment time first.");
      return;
    }
    if (!schedule || !scheduleId) {
      setOrderError("No schedule found for this service.");
      return;
    }
    if (!cartItems.length) {
      setOrderError(
        "Your basket is empty. Please add at least one item first."
      );
      return;
    }

    const finalUserId = resolveUserIdFromStorage(currentUser);
    if (!finalUserId) {
      setOrderError(
        "Could not determine your user. Make sure you are logged in."
      );
      return;
    }

    const startDate = new Date(selectedIso);
    if (Number.isNaN(startDate.getTime())) {
      setOrderError("Invalid appointment time selected.");
      return;
    }

    const slotMinutes = schedule.slot_minutes || 15;
    const endDate = new Date(startDate.getTime() + slotMinutes * 60_000);
    const endIso = endDate.toISOString();

    const sessionId = getConsultationSessionIdFromStorage();
    const rafQA = buildRafQAFromStorage(slug);

    // Build meta.items from cartItems
    const metaItems = cartItems.map((it: any) => {
      const qty = Number(it.qty || 1);
      const unitMinor =
        typeof it.unitMinor === "number"
          ? it.unitMinor
          : typeof it.priceMinor === "number"
          ? it.priceMinor
          : Math.round((it.price ?? 0) * 100);

      const totalMinor =
        typeof it.totalMinor === "number" ? it.totalMinor : unitMinor * qty;

      const variation =
        it.variation ||
        it.variations ||
        it.variationText ||
        it.variant ||
        null;

      return {
        sku: it.sku,
        name: it.name,
        variations: variation,
        strength: it.strength ?? null,
        qty,
        unitMinor,
        totalMinor,
        variation,
      };
    });

    const totalMinor = metaItems.reduce(
      (sum: number, it: any) => sum + (it.totalMinor || 0),
      0
    );

    const lines = metaItems.map((it: any, index: number) => ({
      index,
      name: it.name,
      qty: it.qty,
      variation: it.variation,
    }));

    const first = metaItems[0];
    const selectedProduct = first
      ? {
          name: first.name,
          variation: first.variation,
          strength: first.strength ?? first.variation ?? null,
          qty: first.qty,
          unitMinor: first.unitMinor,
          totalMinor: first.totalMinor,
        }
      : undefined;

    // Merge user info from stored user + /me
    const storedUser = getStoredUserFromStorage();
    const userMeta: Record<string, any> = {};

    const firstName =
      storedUser?.firstName ||
      (storedUser as any)?.first_name ||
      currentUser?.firstName;
    const lastName =
      storedUser?.lastName ||
      (storedUser as any)?.last_name ||
      currentUser?.lastName;
    const email = storedUser?.email || currentUser?.email;
    const phone = storedUser?.phone || currentUser?.phone;
    const dob = storedUser?.dob || currentUser?.dob;

    if (firstName) userMeta.firstName = firstName;
    if (lastName) userMeta.lastName = lastName;
    if (email) userMeta.email = email;
    if (phone) userMeta.phone = phone;
    if (dob) userMeta.dob = dob;

    const meta: Record<string, any> = {
      lines,
      type: "new",
      items: metaItems,
      selectedProduct,
      createdAt: new Date().toISOString(),
      totalMinor,
      consultation_session_id: sessionId ?? undefined,
      service_slug: slug,
      service: schedule.name,
      appointment_start_at: selectedIso,
      formsQA: {
        raf: {
          form_id: null,
          schema_version: null,
          qa: rafQA,
        },
      },
      payment_status: "pending",
      ...userMeta,
    };

    const reference = generateReference();

    const payload: CreateOrderPayload = {
      user_id: finalUserId,
      schedule_id: scheduleId,
      service_id: schedule.service_id,
      reference,
      start_at: selectedIso,
      end_at: endIso,
      meta,
      payment_status: "pending",
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("Creating order with payload:", payload);
    }

    setCreatingOrder(true);
    try {
      const order = await createOrderApi(payload);

      const orderId = order._id;
      const responseRef = order.reference ?? reference;

      try {
        localStorage.setItem("order_last_body", JSON.stringify(payload));
        if (orderId) localStorage.setItem("order_id", String(orderId));
        if (responseRef)
          localStorage.setItem("order_reference", String(responseRef));
      } catch {}

      const qp = new URLSearchParams();
      qp.set("step", "payment");
      if (orderId) qp.set("order", String(orderId));
      if (responseRef) qp.set("reference", String(responseRef));

      router.push(
        `/private-services/${encodeURIComponent(
          slug
        )}/book?${qp.toString()}`
      );
    } catch (e: any) {
      setOrderError(e?.message || "Failed to create order.");
    } finally {
      setCreatingOrder(false);
    }
  }

  return (
    <main className="min-h-screen bg-pharmacy-bg py-6 md:py-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">
              Choose an appointment
            </h1>
            {schedule && (
              <p className="mt-1 text-xs text-gray-500">
                {schedule.name} • Times shown in{" "}
                {schedule.timezone || "local time"} •{" "}
                {schedule.slot_minutes}-minute slots
              </p>
            )}
            {scheduleId && (
              <p className="mt-1 text-[11px] text-gray-400">
                Schedule ID: {scheduleId}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => !atStart && shiftDay(-1)}
                disabled={atStart}
                aria-disabled={atStart}
                className={`rounded-full border px-3 py-1 text-sm ${
                  atStart
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-gray-50"
                }`}
                aria-label="Previous day"
                title={atStart ? undefined : "Previous day"}
              >
                ‹
              </button>
              <div className="min-w-[8rem] text-sm font-medium text-gray-700 text-center">
                {formatYmdForDisplay(date)}
              </div>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="rounded-full border px-3 py-1 text-sm hover:bg-gray-50"
                aria-label="Next day"
                title="Next day"
              >
                ›
              </button>
            </div>

            <div className="hidden sm:block h-5 w-px bg-gray-200" />

            <input
              id="date-picker"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border px-3 py-1 text-sm"
            />
          </div>
        </div>

        <p className="mt-2 text-gray-600 text-sm">
          Select a time below, then continue to create your order.
        </p>

        {/* Override / status banner */}
        {dayMeta?.hasOverride && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Special hours for this date
            {dayMeta.start && dayMeta.end
              ? `: ${dayMeta.start}–${dayMeta.end}`
              : ""}
            {dayMeta.overrideNote ? ` • ${dayMeta.overrideNote}` : ""}
          </div>
        )}

        {closedForDay && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {dayMeta.reason || "We are closed on this date."}
          </div>
        )}

        {orderError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            {orderError}
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-500">
              Loading schedule…
            </div>
          ) : error ? (
            <div className="text-sm text-rose-600">
              Failed to load schedule: {error}
            </div>
          ) : !schedule ? (
            <div className="text-sm text-gray-500">
              No schedule found for this service.
            </div>
          ) : !hasSlots ? (
            <div className="text-sm text-gray-500">
              No slots available for this date.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
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
                    className={`px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition ${
                      isSelected
                        ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50"
                        : "hover:bg-gray-50"
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
                    <div className="font-medium">{s.time}</div>
                    {s.remaining > 0 && (
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {s.remaining} slot
                        {s.remaining === 1 ? "" : "s"} left
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Continue / create order */}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleContinue}
            disabled={
              !selectedIso || creatingOrder || loading || !!error
            }
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition ${
              !selectedIso || creatingOrder || loading || !!error
                ? "bg-emerald-200 text-white cursor-not-allowed opacity-70"
                : "bg-emerald-500 text-white hover:bg-emerald-600"
            }`}
          >
            {creatingOrder ? "Creating order…" : "Continue to payment"}
          </button>
        </div>
      </div>
    </main>
  );
}
