"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart-context";

type Slot = {
  time: string;
  start_at: string; // ISO
  available: boolean;
  remaining: number;
};

type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type WeekConfig = {
  day: WeekDay;
  open: boolean;
  start: string | null; // "09:00"
  end: string | null; // "17:00"
  break_start: string | null; // "12:30"
  break_end: string | null; // "13:00"
};

type OverrideConfig = {
  date: string; // "YYYY-MM-DD"
  open: boolean;
  start: string | null;
  end: string | null;
  note?: string | null;
};

type Schedule = {
  _id: string;
  name: string;
  service_slug: string;
  service_id: string;
  timezone: string;
  slot_minutes: number;
  capacity: number;
  week: WeekConfig[];
  overrides: OverrideConfig[];
};

type DayMeta = {
  open: boolean;
  hasOverride?: boolean;
  start?: string;
  end?: string;
  overrideNote?: string;
  reason?: string;
};

type CurrentUser = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: string;
};

type StoredUser = {
  userId?: string;
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: string;
};

const DAY_MAP: WeekDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const pad2 = (n: number) => String(n).padStart(2, "0");

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function prettyDate(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function splitIsoToParts(iso: string): { date: string; time: string } {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return { date: m[1], time: m[2] };

  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };

  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

function persistAppointment(
  iso: string,
  opts?: { label?: string; serviceSlug?: string }
) {
  const { date, time } = splitIsoToParts(iso);
  const pretty = new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  try {
    if (typeof window !== "undefined") {
      localStorage.setItem("appointment_at", iso);
      sessionStorage.setItem("appointment_at", iso);

      if (date) {
        localStorage.setItem("appointment_date", date);
        sessionStorage.setItem("appointment_date", date);
      }
      if (time) {
        localStorage.setItem("appointment_time", time);
        sessionStorage.setItem("appointment_time", time);
      }
      if (opts?.label) {
        localStorage.setItem("appointment_time_label", opts.label);
      }
      localStorage.setItem("appointment_pretty", pretty);

      if (opts?.serviceSlug) {
        localStorage.setItem("service_slug", opts.serviceSlug);
        sessionStorage.setItem("service_slug", opts.serviceSlug);
      }
    }
  } catch {
    // ignore
  }
}

function toMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function buildSlotsForDate(
  schedule: Schedule,
  yyyyMmDd: string
): { slots: Slot[]; meta: DayMeta } {
  const js = new Date(yyyyMmDd + "T00:00:00");
  if (isNaN(js.getTime())) {
    return { slots: [], meta: { open: false, reason: "Invalid date" } };
  }

  const dayKey = DAY_MAP[js.getDay()];
  const meta: DayMeta = { open: false };

  // base weekly config
  const weekCfg = schedule.week?.find((w) => w.day === dayKey) || null;
  if (!weekCfg || !weekCfg.open) {
    meta.open = false;
    meta.reason = "Closed on this weekday";
  }

  let start = weekCfg?.start ?? null;
  let end = weekCfg?.end ?? null;
  let breakStart = weekCfg?.break_start ?? null;
  let breakEnd = weekCfg?.break_end ?? null;

  // overrides
  const override = schedule.overrides?.find((o) => o.date === yyyyMmDd);
  if (override) {
    meta.hasOverride = true;
    meta.overrideNote = override.note || undefined;
    if (!override.open) {
      meta.open = false;
      meta.reason = override.note || "Closed for this date";
      return { slots: [], meta };
    }
    if (override.start) start = override.start;
    if (override.end) end = override.end;
  }

  const startMin = start ? toMinutes(start) : null;
  const endMin = end ? toMinutes(end) : null;
  if (startMin == null || endMin == null || endMin <= startMin) {
    meta.open = false;
    meta.reason = "No valid opening hours for this day";
    return { slots: [], meta };
  }

  const breakStartMin = breakStart ? toMinutes(breakStart) : null;
  const breakEndMin = breakEnd ? toMinutes(breakEnd) : null;

  let slotMinutes = schedule.slot_minutes || 15;
  if (!Number.isFinite(slotMinutes) || slotMinutes <= 0) slotMinutes = 15;

  const slots: Slot[] = [];
  const now = new Date();

  for (let m = startMin; m + slotMinutes <= endMin; m += slotMinutes) {
    // skip break
    const inBreak =
      breakStartMin != null &&
      breakEndMin != null &&
      breakEndMin > breakStartMin &&
      m >= breakStartMin &&
      m < breakEndMin;
    if (inBreak) continue;

    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const timeLabel = `${pad2(hh)}:${pad2(mm)}`;
    const iso = `${yyyyMmDd}T${timeLabel}:00Z`; // treat schedule as UTC for now

    const slotDate = new Date(iso);
    const isPast = slotDate.getTime() < now.getTime();

    slots.push({
      time: timeLabel,
      start_at: iso,
      available: !isPast,
      remaining: isPast ? 0 : schedule.capacity,
    });
  }

  meta.open = slots.length > 0;
  meta.start = start ?? undefined;
  meta.end = end ?? undefined;
  if (!meta.open && !meta.reason) {
    meta.reason = "No slots left for this day";
  }

  return { slots, meta };
}

// ---- helpers to read additional data for the order meta ----

function getConsultationSessionId(): number | null {
  try {
    const keys = [
      "consultation_session_id",
      "pe_consultation_session_id",
      "consultationSessionId",
    ];
    for (const k of keys) {
      const v =
        (typeof window !== "undefined" &&
          (localStorage.getItem(k) || sessionStorage.getItem(k))) ||
        "";
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {}
  return null;
}

function getRafAnswers(slug?: string | null): Record<string, any> | null {
  if (!slug) return null;
  try {
    const keys = [
      `raf_answers.${slug}`,
      `raf.answers.${slug}`,
      `assessment.answers.${slug}`,
    ];
    for (const k of keys) {
      const raw =
        (typeof window !== "undefined" && localStorage.getItem(k)) || null;
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  return null;
}

function buildRafQA(slug?: string | null): any[] {
  const answers = getRafAnswers(slug);
  if (!answers) return [];
  const out: any[] = [];
  Object.entries(answers).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    const answer = Array.isArray(value) ? value.join(", ") : String(value);
    out.push({
      key,
      question: key, // we don't have labels here, so keep key
      answer,
      raw: value,
    });
  });
  return out;
}

function getAuthToken(): string | null {
  try {
    const t =
      (typeof window !== "undefined" &&
        (localStorage.getItem("token") ||
          localStorage.getItem("auth_token"))) ||
      "";
    return t || null;
  } catch {
    return null;
  }
}

// 🔹 NEW: read stored user object from localStorage (your screenshot)
function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("user_data") ||
      localStorage.getItem("pe_user") ||
      localStorage.getItem("pe.user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    return parsed || null;
  } catch {
    return null;
  }
}

// 🔹 NEW: final user_id (localStorage first, then /me result)
function resolveUserId(currentUser: CurrentUser | null): string | null {
  const stored = getStoredUser();
  const fromStored =
    stored?.userId || stored?._id || stored?.id || null;
  if (fromStored) return String(fromStored);
  if (currentUser?._id) return String(currentUser._id);
  return null;
}

// 🔹 NEW: random reference (you’ll replace later with your real generator)
function generateReference(): string {
  const now = new Date();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${now.getFullYear()}-${random}`;
}

export default function CalendarStep({ serviceSlug }: { serviceSlug?: string }) {
  const params = useParams<{ slug: string }>();
  const slugFromRoute = (params?.slug as string) || "";
  const effectiveServiceSlug = serviceSlug ?? slugFromRoute;

  const router = useRouter();
  const cart = useCart() as any;
  const cartItems: any[] =
    Array.isArray(cart?.items)
      ? cart.items
      : Array.isArray(cart?.state?.items)
      ? cart.state.items
      : [];

  const [date, setDate] = useState<string>(() => ymd(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [dayMeta, setDayMeta] = useState<DayMeta | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const rawBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const apiBase = rawBase.replace(/\/+$/, "");

  const minDate = useMemo(() => ymd(new Date()), []);
  const maxDate = useMemo(() => ymd(addDays(new Date(), 180)), []);

  // persist slug
  useEffect(() => {
    if (!effectiveServiceSlug) return;
    try {
      localStorage.setItem("service_slug", effectiveServiceSlug);
      sessionStorage.setItem("service_slug", effectiveServiceSlug);
    } catch {}
  }, [effectiveServiceSlug]);

  // 1) Load schedule list and pick schedule by service_slug
  useEffect(() => {
    if (!effectiveServiceSlug) {
      setLoading(false);
      setError("Missing service slug; cannot load schedule.");
      return;
    }

    let cancelled = false;

    async function loadSchedules() {
      setLoading(true);
      setError(null);
      setSchedule(null);
      setScheduleId(null);

      try {
        const res = await fetch(`${apiBase}/api/schedules`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Schedules HTTP ${res.status}: ${
              txt?.slice(0, 180) || "request failed"
            }`
          );
        }

        const json = await res.json();
        if (cancelled) return;

        let list: Schedule[] = [];
        if (Array.isArray((json as any)?.data)) {
          list = (json as any).data;
        } else if (Array.isArray(json)) {
          list = json;
        }

        const match =
          list.find((s) => s.service_slug === effectiveServiceSlug) ||
          list[0];

        if (!match) {
          throw new Error("No schedule configured for this service yet.");
        }

        setSchedule(match);
        setScheduleId(match._id);

        try {
          localStorage.setItem("schedule_id", match._id);
          sessionStorage.setItem("schedule_id", match._id);
        } catch {}
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load schedule.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSchedules();
    return () => {
      cancelled = true;
    };
  }, [apiBase, effectiveServiceSlug]);

  // 2) Fetch current user (for meta fields; user_id also comes from localStorage)
  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetch(`${apiBase}/api/users/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (!cancelled && json && (json._id || json.id || json.userId)) {
          setCurrentUser({
            _id: json._id || json.id || json.userId,
            firstName: json.firstName || json.first_name,
            lastName: json.lastName || json.last_name,
            email: json.email,
            phone: json.phone || json.mobile,
            dob: json.dob,
          });
        }
      } catch {
        // ignore
      }
    }

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  // 3) Build slots whenever schedule or date changes
  useEffect(() => {
    if (!schedule) {
      setSlots([]);
      setDayMeta(null);
      return;
    }
    const { slots: built, meta } = buildSlotsForDate(schedule, date);
    setSlots(built);
    setDayMeta(meta);
    setSelectedIso(null);
  }, [schedule, date]);

  function shiftDay(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = ymd(d);
    if (next < minDate || next > maxDate) return;
    setDate(next);
  }

  const atStart = date <= minDate;

  function handleSelect(iso: string, label?: string) {
    setSelectedIso(iso);
    persistAppointment(iso, {
      label,
      serviceSlug: effectiveServiceSlug,
    });
  }

  const hasSlots = slots.length > 0;
  const closedForDay =
    !loading && !!dayMeta && dayMeta.open === false && !hasSlots;

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
      setOrderError("Your basket is empty. Please add at least one item first.");
      return;
    }

    // 🔹 Get final user_id (from localStorage.user OR /me fallback)
    const finalUserId = resolveUserId(currentUser);
    if (!finalUserId) {
      setOrderError(
        "Could not determine your user. Make sure you are logged in (user_id missing)."
      );
      return;
    }

    const startDate = new Date(selectedIso);
    if (isNaN(startDate.getTime())) {
      setOrderError("Invalid appointment time selected.");
      return;
    }

    const slotMinutes = schedule.slot_minutes || 15;
    const endDate = new Date(startDate.getTime() + slotMinutes * 60_000);
    const endIso = endDate.toISOString();

    const sessionId = getConsultationSessionId();
    const rafQA = buildRafQA(effectiveServiceSlug);

    // build meta.items from cartItems
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

    // merge user info from stored user + /me
    const storedUser = getStoredUser();
    const userMeta: Record<string, any> = {};

    const firstName =
      storedUser?.firstName ||
      storedUser?.["first_name" as keyof StoredUser] ||
      currentUser?.firstName;
    const lastName =
      storedUser?.lastName ||
      storedUser?.["last_name" as keyof StoredUser] ||
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
      service_slug: effectiveServiceSlug,
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

    // 🔹 NEW: generate random reference for now
    const reference = generateReference();

    const body: any = {
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
      console.log("Creating order with body:", body);
    }

    setCreatingOrder(true);
    try {
      const res = await fetch(`${apiBase}/api/orders`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const text = await res.text().catch(() => "");
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg =
          json?.message ||
          (typeof json === "string" ? json : "") ||
          `Order HTTP ${res.status}`;
        setOrderError(msg);
        return;
      }

      const orderId = json?._id ?? json?.id ?? null;
      const responseRef = json?.reference ?? reference;

      try {
        localStorage.setItem("order_last_body", JSON.stringify(body));
        if (orderId) localStorage.setItem("order_id", String(orderId));
        if (responseRef)
          localStorage.setItem("order_reference", String(responseRef));
      } catch {}

      const qp = new URLSearchParams();
      qp.set("step", "payment");
      if (orderId) qp.set("order", String(orderId));
      if (responseRef) qp.set("reference", String(responseRef));

      router.push(
        `/private-services/${effectiveServiceSlug}/book?${qp.toString()}`
      );
    } catch (e: any) {
      setOrderError(e?.message || "Failed to create order.");
    } finally {
      setCreatingOrder(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Choose an appointment</h2>
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
              {prettyDate(date)}
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
                  onClick={() => !isDisabled && handleSelect(s.start_at, s.time)}
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
                    isDisabled ? "This time is not available" : "Select this time"
                  }
                >
                  <div className="font-medium">{s.time}</div>
                  {s.remaining > 0 && (
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {s.remaining} slot{s.remaining === 1 ? "" : "s"} left
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
          disabled={!selectedIso || creatingOrder || loading || !!error}
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
  );
}
