"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart, type CartItem } from "@/components/cart/cart-context";
import { ensureDraftOrder } from "../rebooking-order";

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
  updateOrderApi,
  resolveUserIdFromStorage,
  type CreateAppointmentPayload,
  fetchBookedSlotsApi,
  type BookedSlotsResponse,
  sendEmailApi,
  getStoredUserFromStorage,
  updateAppointmentApi,
  createZoomMeetingApi,
  type ZoomMeetingDto,
  fetchServiceBySlug,
} from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Props                                                              */
/* ------------------------------------------------------------------ */

export type CalendarStepProps = {
  serviceSlug?: string;
  autoContinue?: boolean;
  goToPaymentStep?: () => void;
};

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const safeStorage = {
  get(key: string): string {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  },
  set(key: string, value: string) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  },
  setSession(key: string, value: string) {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {}
  },
  setBoth(key: string, value: string) {
    safeStorage.set(key, value);
    safeStorage.setSession(key, value);
  },
};

function safeJsonParse<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatIsoInTimeZone(iso: string, tz: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function readIdFromLocal(keys: string[]): string | null {
  if (typeof window === "undefined") return null;
  for (const key of keys) {
    try {
      const v = window.localStorage.getItem(key);
      if (v && v !== "undefined" && v !== "null") return v;
    } catch {}
  }
  return null;
}

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
      (ci as any).service_id ||
      (ci as any).serviceId ||
      ((ci as any).service &&
        ((ci as any).service._id || (ci as any).service.id)) ||
      null;
    if (cid) return String(cid);
  }

  return null;
}

function formatForEmail(iso: string, tz: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/* ------------------------------------------------------------------ */
/* Service resolution (robust)                                         */
/* ------------------------------------------------------------------ */

type ServiceLite = {
  _id?: string;
  id?: string;
  slug?: string;
  name?: string;
  appointment_medium?: string;
  appointmentMedium?: string;
  [k: string]: any;
};

function resolveServiceFromLocal(slug: string): ServiceLite | null {
  if (typeof window === "undefined") return null;

  const keys = [
    `service.${slug}`,
    "service",
    "selected_service",
    "pe_service",
    "service_cache",
  ];

  for (const k of keys) {
    try {
      const raw = window.localStorage.getItem(k) || "";
      if (!raw) continue;

      const parsed: any = JSON.parse(raw);
      const svc: any = parsed?.service || parsed;

      const svcSlug = String(svc?.slug || "").trim();
      if (svcSlug && slug && svcSlug !== slug) continue;

      if (svc && typeof svc === "object") return svc as ServiceLite;
    } catch {}
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Customer identity (email)                                           */
/* ------------------------------------------------------------------ */

function resolveCustomerFromStorage(): { email: string; name: string } {
  if (typeof window === "undefined") return { email: "", name: "" };

  try {
    const u: any =
      typeof getStoredUserFromStorage === "function"
        ? getStoredUserFromStorage()
        : null;

    const email =
      u?.email || u?.user?.email || u?.username || u?.user?.username || "";

    const name =
      `${u?.firstName || u?.user?.firstName || ""} ${
        u?.lastName || u?.user?.lastName || ""
      }`.trim() ||
      u?.fullName ||
      u?.user?.fullName ||
      u?.name ||
      u?.user?.name ||
      "";

    if (email) return { email: String(email), name: String(name || "Customer") };
  } catch {}

  const candidates = ["pharmacy_user", "user", "pe_user", "auth_user"];
  for (const k of candidates) {
    try {
      const raw = window.localStorage.getItem(k) || "";
      if (!raw) continue;
      const parsed: any = JSON.parse(raw);
      const u = parsed?.user || parsed;

      const email =
        u?.email ||
        u?.username ||
        (typeof u?.contact === "object" ? u.contact?.email : "") ||
        "";

      const name =
        `${u?.firstName || u?.first_name || ""} ${
          u?.lastName || u?.last_name || ""
        }`.trim() ||
        u?.fullName ||
        u?.full_name ||
        u?.name ||
        "";

      if (email) return { email: String(email), name: String(name || "Customer") };
    } catch {}
  }

  return { email: "", name: "" };
}

/* ------------------------------------------------------------------ */
/* Zoom helpers (robust extraction)                                    */
/* ------------------------------------------------------------------ */

type ZoomMeeting = ZoomMeetingDto;

function pickJoinUrl(m: any) {
  const x =
    m?.join_url ||
    m?.joinUrl ||
    m?.joinURL ||
    m?.data?.join_url ||
    m?.data?.joinUrl ||
    m?.data?.joinURL ||
    "";
  return String(x || "").trim();
}

function pickMeetingId(m: any) {
  const x =
    m?.id ??
    m?.meeting_id ??
    m?.meetingId ??
    m?.data?.id ??
    m?.data?.meeting_id ??
    m?.data?.meetingId ??
    "";
  return String(x ?? "").trim();
}

function pickPasscode(m: any) {
  const x =
    m?.password ||
    m?.passcode ||
    m?.zoomPasscode ||
    m?.data?.password ||
    m?.data?.passcode ||
    m?.data?.zoomPasscode ||
    "";
  return String(x || "").trim();
}

function pickHostUrl(m: any) {
  const x =
    m?.start_url ||
    m?.startUrl ||
    m?.host_url ||
    m?.hostUrl ||
    m?.data?.start_url ||
    m?.data?.startUrl ||
    m?.data?.host_url ||
    m?.data?.hostUrl ||
    "";
  return String(x || "").trim();
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function CalendarStep({
  serviceSlug,
  autoContinue,
  goToPaymentStep,
}: CalendarStepProps) {
  const params = useParams<{ slug: string }>();
  const slug = serviceSlug || params?.slug || "";

  const router = useRouter();
  const cart = useCart();

  const cartItems: CartItem[] = useMemo(() => {
    return Array.isArray((cart as any)?.items)
      ? (cart as any).items
      : Array.isArray((cart as any)?.state?.items)
      ? (cart as any).state.items
      : [];
  }, [cart]);

  const [date, setDate] = useState<string>(() => dateToYmd(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [service, setService] = useState<ServiceLite | null>(null);

  const [dayMeta, setDayMeta] = useState<DayMeta | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [appointmentSuccess, setAppointmentSuccess] = useState<string | null>(null);
  const [hasCreatedAppointment, setHasCreatedAppointment] = useState(false);

  const [bookedSlots, setBookedSlots] = useState<BookedSlotsResponse | null>(null);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  const minDate = useMemo(() => dateToYmd(new Date()), []);
  const maxDate = useMemo(() => dateToYmd(addDaysUtc(new Date(), 180)), []);

  const atStart = date <= minDate;

  const scheduleTimezone = useMemo(() => {
    const tz = String((schedule as any)?.timezone || "").trim();
    return tz || "Europe/London";
  }, [schedule]);

  const slotMinutes = useMemo(
    () => Number((schedule as any)?.slot_minutes || 15),
    [schedule]
  );

  const serviceName = useMemo(() => {
    return (
      (service?.name ? String(service.name) : "") ||
      String((schedule as any)?.service?.name || "") ||
      ""
    );
  }, [service, schedule]);

  // ✅ medium detection (uses your service field)
  const appointmentMedium = useMemo(() => {
    const raw =
      service?.appointment_medium ||
      service?.appointmentMedium ||
      (schedule as any)?.service?.appointment_medium ||
      (schedule as any)?.service?.appointmentMedium ||
      (schedule as any)?.appointment_medium ||
      (schedule as any)?.appointmentMedium ||
      safeStorage.get(`appointment_medium.${slug}`) ||
      safeStorage.get("appointment_medium") ||
      "";

    return String(raw).toLowerCase().trim();
  }, [service, schedule, slug]);

  const isOnlineMedium = useMemo(() => {
    const v = appointmentMedium;
    return v === "online" || v.includes("online") || v.includes("zoom") || v.includes("video");
  }, [appointmentMedium]);

  useEffect(() => {
    if (!appointmentMedium) return;
    safeStorage.setBoth("appointment_medium", appointmentMedium);
    safeStorage.setBoth(`appointment_medium.${slug}`, appointmentMedium);
  }, [appointmentMedium, slug]);

  // Filter schedule overrides to only this service
  const effectiveSchedule: Schedule | null = useMemo(() => {
    if (!schedule) return null;

    const sch: any = schedule;
    const currentServiceId = resolveServiceId(schedule, cartItems);

    const rawOverrides = Array.isArray(sch.overrides) ? sch.overrides : null;
    if (!rawOverrides) return schedule;

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

    return { ...(schedule as any), overrides: filteredOverrides } as Schedule;
  }, [schedule, cartItems, slug]);

  /* ------------------------------------------------------------------ */
  /* Zoom (single-flight + cache)                                       */
  /* ------------------------------------------------------------------ */

  const zoomLocksRef = useRef<Map<string, Promise<ZoomMeeting | null>>>(new Map());
  const [zoomCreating, setZoomCreating] = useState(false);
  const [zoomError, setZoomError] = useState<string | null>(null);

  const [zoomPreview, setZoomPreview] = useState<{
    iso: string;
    joinUrl: string;
    meetingId: string;
    passcode: string;
  } | null>(null);

  const zoomStorageKey = useCallback(
    (iso: string) => `zoom_meeting.${slug}.${iso}`,
    [slug]
  );

  const readZoomMeetingFromStorage = useCallback(
    (iso: string): ZoomMeeting | null => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.localStorage.getItem(zoomStorageKey(iso));
        return safeJsonParse<ZoomMeeting>(raw);
      } catch {
        return null;
      }
    },
    [zoomStorageKey]
  );

  const writeZoomMeetingToStorage = useCallback(
    (iso: string, meeting: ZoomMeeting) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(zoomStorageKey(iso), JSON.stringify(meeting));
      } catch {}
    },
    [zoomStorageKey]
  );

  const ensureZoomMeetingForIso = useCallback(
    (iso: string): Promise<ZoomMeeting | null> => {
      if (!isOnlineMedium) return Promise.resolve(null);

      const lockKey = `${slug}::${iso}`;
      const locks = zoomLocksRef.current;
      if (locks.has(lockKey)) return locks.get(lockKey)!;

      const p = (async () => {
        const cached = readZoomMeetingFromStorage(iso);
        if (cached && (pickJoinUrl(cached) || pickMeetingId(cached))) return cached;

        const baseName = serviceName || "Consultation";
        const topic = `${baseName} consultancy call`;

        setZoomCreating(true);
        setZoomError(null);

        const meetingRaw: any = await createZoomMeetingApi({
          topic,
          start_time: iso,
          duration: Number.isFinite(slotMinutes) ? slotMinutes : 15,
          timezone: scheduleTimezone,
          agenda: baseName,
        });

        const meeting: any = meetingRaw?.data ? meetingRaw.data : meetingRaw;

        writeZoomMeetingToStorage(iso, meeting as any);
        return meeting as any;
      })()
        .catch((e: any) => {
          const msg = e?.message || "Failed to create Zoom meeting.";
          setZoomError(msg);
          return null;
        })
        .finally(() => {
          locks.delete(lockKey);
          setZoomCreating(false);
        });

      locks.set(lockKey, p);
      return p;
    },
    [
      isOnlineMedium,
      slug,
      readZoomMeetingFromStorage,
      serviceName,
      slotMinutes,
      scheduleTimezone,
      writeZoomMeetingToStorage,
    ]
  );

  /* ------------------------------------------------------------------ */
  /* Persist selection across tabs/reloads                               */
  /* ------------------------------------------------------------------ */

  const selectedIsoKey = useMemo(() => `selected_iso.${slug}`, [slug]);
  const selectedLabelKey = useMemo(() => `selected_label.${slug}`, [slug]);

  // restore selection on mount / slug change
  useEffect(() => {
    if (!slug) return;
    const savedIso = safeStorage.get(selectedIsoKey);
    if (savedIso) setSelectedIso(savedIso);
  }, [slug, selectedIsoKey]);

  // cross-tab: if another tab changes selected slot, reflect it here
  useEffect(() => {
    if (!slug) return;

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === selectedIsoKey) {
        const v = String(e.newValue || "").trim();
        setSelectedIso(v || null);
      }
    };

    const onVisibility = () => {
      if (document.hidden) return;
      const savedIso = safeStorage.get(selectedIsoKey);
      if (savedIso) setSelectedIso(savedIso);
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [slug, selectedIsoKey]);

  /* ------------------------------------------------------------------ */
  /* Handlers                                                           */
  /* ------------------------------------------------------------------ */

  const handleDateChange = useCallback(
    (e: any) => {
      let value = (e?.target?.value || "") as string;
      if (!value) return;

      if (value < minDate) value = minDate;
      if (value > maxDate) value = maxDate;

      setDate(value);
    },
    [minDate, maxDate]
  );

  const shiftDay = useCallback(
    (delta: number) => {
      setDate((prev) => {
        const d = new Date(prev + "T00:00:00");
        d.setDate(d.getDate() + delta);
        const next = dateToYmd(d);
        if (next < minDate) return prev;
        if (next > maxDate) return prev;
        return next;
      });
    },
    [minDate, maxDate]
  );

  // ✅ slot click: persist selection AND trigger zoom immediately (online)
  const handleSelect = useCallback(
    (iso: string, label?: string) => {
      setSelectedIso(iso);
      setAppointmentError(null);
      setAppointmentSuccess(null);
      setEmailError(null);
      setEmailStatus("idle");
      setZoomError(null);
      setZoomPreview(null);

      safeStorage.setBoth(selectedIsoKey, iso);
      if (label) safeStorage.setBoth(selectedLabelKey, label);

      persistAppointmentSelection(iso, { label, serviceSlug: slug });

      if (isOnlineMedium) {
        void (async () => {
          const m = await ensureZoomMeetingForIso(iso);
          const joinUrl = pickJoinUrl(m);
          if (!joinUrl) {
            setZoomError((prev) => prev || "Zoom meeting could not be created for this slot.");
            return;
          }
          setZoomPreview({
            iso,
            joinUrl,
            meetingId: pickMeetingId(m),
            passcode: pickPasscode(m),
          });
        })();
      }
    },
    [slug, isOnlineMedium, ensureZoomMeetingForIso, selectedIsoKey, selectedLabelKey]
  );

  /* ------------------------------------------------------------------ */
  /* Effects                                                            */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!slug) return;
    safeStorage.setBoth("service_slug", slug);
  }, [slug]);

  // Load schedule + service
  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Missing service slug; cannot load schedule.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const localSvc = resolveServiceFromLocal(slug);
        if (!cancelled && localSvc) setService(localSvc);

        const [sch, svc] = await Promise.all([
          fetchScheduleForServiceSlug(slug),
          fetchServiceBySlug(slug),
        ]);

        if (cancelled) return;

        // your APIs return plain objects, but we still defensively handle {data:...}
        const schAny: any = (sch as any)?.data ? (sch as any).data : sch;
        const svcAny: any = (svc as any)?.data ? (svc as any).data : svc;

        setSchedule(schAny);
        setScheduleId((schAny as any)?._id || null);

        if (svcAny) setService(svcAny);

        const sid = (schAny as any)?._id ? String((schAny as any)._id) : "";
        if (sid) {
          safeStorage.setBoth("schedule_id", sid);
          safeStorage.setBoth(`schedule_id.${slug}`, sid);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to load schedule.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Build slots
  useEffect(() => {
    if (!effectiveSchedule) {
      setSlots([]);
      setDayMeta(null);
      setHasCreatedAppointment(false);
      return;
    }

    const { slots: built, meta } = buildSlotsForDate(effectiveSchedule, date);
    setSlots(built);
    setDayMeta(meta);

    setAppointmentError(null);
    setAppointmentSuccess(null);
    setEmailError(null);
    setEmailStatus("idle");
    setZoomError(null);

    // keep selectedIso if it still exists in today's slots, else clear
    setSelectedIso((prev) => {
      if (!prev) return prev;
      const exists = built.some((s) => s.start_at === prev);
      return exists ? prev : null;
    });
    setHasCreatedAppointment(false);
  }, [effectiveSchedule, date]);

  // Fetch booked slots
  useEffect(() => {
    if (!scheduleId || !date) {
      setBookedSlots(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await fetchBookedSlotsApi(String(scheduleId), date);
        if (!cancelled) setBookedSlots(data);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to load booked slots", err);
        }
        if (!cancelled) setBookedSlots(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scheduleId, date]);

  // Duplicate guard
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!slug || !selectedIso) {
      setHasCreatedAppointment(false);
      return;
    }
    const key = `appointment_created.${slug}.${selectedIso}`;
    try {
      setHasCreatedAppointment(window.localStorage.getItem(key) === "1");
    } catch {
      setHasCreatedAppointment(false);
    }
  }, [slug, selectedIso]);

  // ✅ If selectedIso exists and medium is online, ensure Zoom exists (tab refocus / service loads later)
  useEffect(() => {
    if (!selectedIso) return;
    if (!isOnlineMedium) return;

    let cancelled = false;

    (async () => {
      const cached = readZoomMeetingFromStorage(selectedIso);
      const cachedJoin = pickJoinUrl(cached);
      if (cachedJoin) {
        setZoomPreview({
          iso: selectedIso,
          joinUrl: cachedJoin,
          meetingId: pickMeetingId(cached),
          passcode: pickPasscode(cached),
        });
        return;
      }

      const m = await ensureZoomMeetingForIso(selectedIso);
      if (cancelled) return;

      const joinUrl = pickJoinUrl(m);
      if (!joinUrl) {
        setZoomError((prev) => prev || "Zoom meeting could not be created for this slot.");
        return;
      }
      setZoomPreview({
        iso: selectedIso,
        joinUrl,
        meetingId: pickMeetingId(m),
        passcode: pickPasscode(m),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedIso, isOnlineMedium, ensureZoomMeetingForIso, readZoomMeetingFromStorage]);

  const hasSlots = slots.length > 0;
  const closedForDay = !loading && !!dayMeta && dayMeta.open === false && !hasSlots;

  /* ------------------------------------------------------------------ */
  /* Continue: order + appointment + zoom + email                        */
  /* ------------------------------------------------------------------ */

  const handleContinue = useCallback(async () => {
    setAppointmentError(null);
    setAppointmentSuccess(null);
    setEmailError(null);
    setEmailStatus("idle");

    if (!selectedIso) {
      setAppointmentError("Please select an appointment time first.");
      return;
    }
    if (!schedule) {
      setAppointmentError("No schedule found for this service.");
      return;
    }
    if (!cartItems.length) {
      setAppointmentError("Your basket is empty. Please add at least one treatment before booking.");
      return;
    }
    if (hasCreatedAppointment) {
      setAppointmentError("An appointment has already been created for this time.");
      return;
    }

    const userIdFromLocal = readIdFromLocal(["user_id", "pe_user_id", "userId", "patient_id"]);
    const userId = userIdFromLocal || resolveUserIdFromStorage();
    if (!userId) {
      setAppointmentError("You need to be logged in to book an appointment.");
      return;
    }

    const serviceIdFromLocal = readIdFromLocal(["service_id", "pe_service_id", "serviceId"]);
    const serviceId = serviceIdFromLocal || resolveServiceId(schedule, cartItems);
    if (!serviceId) {
      setAppointmentError(
        "Missing service information for this booking. Please start again from the service page."
      );
      return;
    }

    const scheduleIdFromLocal = readIdFromLocal([
      `schedule_id.${slug}`,
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

    const endDate = new Date(startDate.getTime() + slotMinutes * 60_000);
    const endIso = endDate.toISOString();

    setCreatingAppointment(true);

    try {
      // 0) Zoom (online only)
      let zoomMeeting: ZoomMeeting | null = null;
      let join = "";
      let meetingId = "";
      let passcode = "";
      let hostUrl = "";

      if (isOnlineMedium) {
        zoomMeeting = await ensureZoomMeetingForIso(selectedIso);
        join = pickJoinUrl(zoomMeeting);
        meetingId = pickMeetingId(zoomMeeting);
        passcode = pickPasscode(zoomMeeting);
        hostUrl = pickHostUrl(zoomMeeting);

        if (!join) {
          setAppointmentError(zoomError || "Could not create Zoom meeting. Please try selecting the time again.");
          return;
        }
      }

      // 1) Draft order
      const orderId = await ensureDraftOrder({
        slug,
        userId: String(userId),
        serviceId: String(serviceId),
        serviceName: serviceName || (service as any)?.name || (schedule as any)?.service?.name,
        cartItems,
        currency: "GBP",
        scheduleId: String(effectiveScheduleId),
        startAt: selectedIso,
        endAt: endIso,
      });

      safeStorage.setBoth("order_id", String(orderId));
      safeStorage.setBoth(`order_id.${slug}`, String(orderId));

      // 2) Create appointment
      const appointmentPayload: CreateAppointmentPayload = {
        order_id: String(orderId),
        user_id: String(userId),
        service_id: String(serviceId),
        schedule_id: String(effectiveScheduleId),
        start_at: selectedIso,
        end_at: endIso,
      };

      const appointment = await createAppointmentApi(appointmentPayload);

      const appointmentId = (appointment as any)?._id || (appointment as any)?.id || null;
      const appointmentStart =
        (appointment as any)?.start_at || (appointment as any)?.startAt || selectedIso;

      // mirror cache if backend start differs
      if (isOnlineMedium && zoomMeeting && appointmentStart && appointmentStart !== selectedIso) {
        writeZoomMeetingToStorage(String(appointmentStart), zoomMeeting);
      }

      // Update appointment with zoom URLs (non-blocking)
      if (isOnlineMedium && appointmentId && join) {
        try {
          await updateAppointmentApi(String(appointmentId), {
            join_url: join,
            host_url: hostUrl,
            meeting_id: meetingId,
            passcode: passcode,
          } as any);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.error("Failed to update appointment with Zoom fields:", err);
          }
        }
      }

      // 3) Mark order booked
      try {
        await updateOrderApi(String(orderId), {
          is_appointment_booked: true,
        } as any);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to update order is_appointment_booked flag:", err);
        }
      }

      // 4) Persist duplicate guard (save for both keys)
      try {
        if (appointmentId) safeStorage.set("appointment_id", String(appointmentId));
        safeStorage.set(`appointment_created.${slug}.${selectedIso}`, "1");
        safeStorage.set(`appointment_created.${slug}.${appointmentStart}`, "1");
        setHasCreatedAppointment(true);
      } catch {}

      // 5) Email (online only) — do NOT block booking if email fails
      if (isOnlineMedium) {
        const emailKey = appointmentId
          ? `zoom_email_sent.${appointmentId}`
          : `zoom_email_sent.${slug}.${appointmentStart}`;

        const alreadySent =
          typeof window !== "undefined" && window.localStorage.getItem(emailKey) === "1";

        if (!alreadySent) {
          const customer = resolveCustomerFromStorage();
          const to = customer.email;

          if (!to) {
            setEmailStatus("failed");
            setEmailError("Email not sent: customer email is missing in storage.");
          } else {
            const baseName = serviceName || "Consultation";
            const topic = `${baseName} consultancy call`;
            const tz = String((schedule as any)?.timezone || "Europe/London");

            setEmailStatus("sending");
            try {
              const result = await sendEmailApi({
                to,
                subject: `${baseName} Zoom appointment confirmed`,
                template: "zoom",
                context: {
                  name: customer.name || "Customer",
                  email: to,
                  serviceName: baseName,
                  appointmentAt: formatForEmail(String(appointmentStart), tz),
                  durationMinutes: slotMinutes,
                  topic,
                  orderId: String(orderId),
                  appointmentId: appointmentId ? String(appointmentId) : "",

                  joinUrl: join,
                  zoomJoinUrl: join,
                  join_url: join,

                  meetingId: meetingId,
                  zoomMeetingId: meetingId,
                  meeting_id: meetingId,
                  id: meetingId,

                  passcode: passcode,
                  zoomPasscode: passcode,
                  password: passcode,
                },
              });

              if (result && (result as any).success === false) {
                throw new Error((result as any).message || "Email sending failed (success=false).");
              }

              try {
                window.localStorage.setItem(emailKey, "1");
              } catch {}

              setEmailStatus("sent");
            } catch (e: any) {
              setEmailStatus("failed");
              setEmailError(e?.message || "Email could not be sent.");
            }
          }
        } else {
          setEmailStatus("sent");
        }
      }

      setAppointmentSuccess("Appointment booked successfully. Redirecting to payment…");

      if (goToPaymentStep) {
        goToPaymentStep();
        return;
      }

      const qp = new URLSearchParams();
      qp.set("service_slug", slug);
      qp.set("slug", slug);
      qp.set("order", String(orderId));
      qp.set("step", "payment");
      qp.set("appointment_at", String(selectedIso));

      router.push(`/private-services/${encodeURIComponent(slug)}/book?${qp.toString()}`);
    } catch (e: any) {
      const msg = e?.message || "Failed to create booking.";
      setAppointmentError(msg);
    } finally {
      setCreatingAppointment(false);
    }
  }, [
    selectedIso,
    schedule,
    cartItems,
    hasCreatedAppointment,
    slug,
    scheduleId,
    slotMinutes,
    isOnlineMedium,
    ensureZoomMeetingForIso,
    zoomError,
    serviceName,
    service,
    router,
    goToPaymentStep,
    writeZoomMeetingToStorage,
  ]);

  /* ------------------------------------------------------------------ */
  /* UI                                                                 */
  /* ------------------------------------------------------------------ */

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
                {serviceName || (schedule as any).name} • Times shown in{" "}
                <span className="font-medium">
                  {(schedule as any).timezone || "local time"}
                </span>{" "}
                • {(schedule as any).slot_minutes}-minute slots
                {appointmentMedium ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    Medium: {appointmentMedium}
                  </span>
                ) : null}
                {isOnlineMedium ? (
                  <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Online
                  </span>
                ) : null}
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

              {date === minDate && (
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
              <label htmlFor="date-picker" className="text-[11px] text-gray-500">
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
          Select an available time below, then continue to payment to confirm your booking.
        </p>

        {/* Override / status banner */}
        {dayMeta?.hasOverride && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Special hours for this date
            {dayMeta.start && dayMeta.end ? `: ${dayMeta.start}–${dayMeta.end}` : ""}
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

        {emailError && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            Email status: {emailError}
          </div>
        )}

        {appointmentSuccess && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            {appointmentSuccess}
          </div>
        )}

        {zoomError && isOnlineMedium && selectedIso ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            Zoom error: {zoomError}
          </div>
        ) : null}

        {isOnlineMedium && selectedIso && zoomPreview?.iso === selectedIso && zoomPreview.joinUrl ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
            Zoom ready for this slot.
          </div>
        ) : null}

        {/* Slots */}
        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-gray-500">Loading schedule…</div>
          ) : error ? (
            <div className="text-sm text-rose-600">Failed to load schedule: {error}</div>
          ) : !schedule ? (
            <div className="text-sm text-gray-500">No schedule found for this service.</div>
          ) : !slots.length ? (
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

                const isDisabled = !s.available || s.remaining <= 0 || isFullFromApi;

                return (
                  <button
                    key={s.start_at}
                    type="button"
                    onClick={() => !isDisabled && handleSelect(s.start_at, s.time)}
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
                    title={isDisabled ? "This time is not available" : "Select this time"}
                  >
                    <div className="font-medium p-3">
                      {s.time}
                      {isFullFromApi && (
                        <span className="ml-1 text-[10px] text-rose-500">(Full)</span>
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
                    {formatIsoInTimeZone(selectedIso, String((schedule as any)?.timezone || "Europe/London"))}
                  </span>

                  {hasCreatedAppointment && (
                    <span className="ml-2 text-emerald-600 font-medium">
                      • Appointment already created for this time
                    </span>
                  )}

                  {isOnlineMedium && zoomCreating && (
                    <span className="ml-2 text-gray-500 font-medium">
                      • Creating Zoom meeting…
                    </span>
                  )}

                  {isOnlineMedium && !zoomCreating && zoomPreview?.iso === selectedIso && zoomPreview?.joinUrl ? (
                    <span className="ml-2 text-emerald-700 font-medium">
                      • Zoom ready
                    </span>
                  ) : null}

                  {isOnlineMedium && emailStatus === "sending" ? (
                    <span className="ml-2 text-gray-500 font-medium">• Email sending…</span>
                  ) : emailStatus === "sent" ? (
                    <span className="ml-2 text-emerald-700 font-medium">• Email sent</span>
                  ) : emailStatus === "failed" ? (
                    <span className="ml-2 text-amber-700 font-medium">• Email failed</span>
                  ) : null}
                </>
              ) : (
                "No time selected yet."
              )}
            </div>

            <button
              type="button"
              onClick={handleContinue}
              disabled={
                creatingAppointment ||
                !selectedIso ||
                hasCreatedAppointment ||
                (isOnlineMedium && zoomCreating)
              }
              className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm ${
                creatingAppointment ||
                !selectedIso ||
                hasCreatedAppointment ||
                (isOnlineMedium && zoomCreating)
                  ? "bg-emerald-300 cursor-not-allowed opacity-80"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {creatingAppointment
                ? "Booking…"
                : hasCreatedAppointment
                ? "Appointment created"
                : isOnlineMedium && zoomCreating
                ? "Preparing Zoom…"
                : "Book appointment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
