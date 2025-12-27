"use client";

import {
  createOrderApi,
  updateOrderApi,
  fetchScheduleForServiceSlug,
  buildRafQAFromStorage,
  getLoggedInUserApi,
  fetchOrderByReferenceApi,
  type LoggedInUser,
} from "@/lib/api";

/** Per-slug order id key (prevents collisions across services) */
export const ORDER_ID_KEY = (slug: string) => `order_id.${slug}`;

/** Per-slug order reference key (stable across steps; helps recover order if id not stored) */
export const ORDER_REF_KEY = (slug: string) => `order_ref.${slug}`;

/** ✅ Per-slug finalized key: when set, NEVER create a new order implicitly */
export const ORDER_FINALIZED_KEY = (slug: string) => `order_finalized.${slug}`;

/** Generic storage reader (localStorage -> sessionStorage) */
function readFirst(keys: string[]): string | null {
  if (typeof window === "undefined") return null;
  for (const k of keys) {
    try {
      const v =
        window.localStorage.getItem(k) ||
        window.sessionStorage.getItem(k) ||
        null;
      if (v && v !== "undefined" && v !== "null") return String(v);
    } catch {}
  }
  return null;
}

function writeBoth(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

export function getOrderIdForSlug(slug: string): string | null {
  if (!slug) return null;
  return readFirst([ORDER_ID_KEY(slug), "order_id"]);
}

export function setOrderIdForSlug(slug: string, orderId: string) {
  if (!slug || !orderId) return;
  writeBoth(ORDER_ID_KEY(slug), String(orderId));
  writeBoth("order_id", String(orderId)); // legacy/global key
}

export function getOrderRefForSlug(slug: string): string | null {
  if (!slug) return null;
  return readFirst([ORDER_REF_KEY(slug), "order_ref"]);
}

export function setOrderRefForSlug(slug: string, ref: string) {
  if (!slug || !ref) return;
  writeBoth(ORDER_REF_KEY(slug), String(ref));
  writeBoth("order_ref", String(ref)); // optional alias
}

/** ✅ finalized helpers */
export function getFinalizedOrderForSlug(slug: string): string | null {
  if (!slug) return null;
  return readFirst([ORDER_FINALIZED_KEY(slug)]);
}

export function setFinalizedOrderForSlug(slug: string, orderId: string) {
  if (!slug || !orderId) return;
  writeBoth(ORDER_FINALIZED_KEY(slug), String(orderId));
}

export function clearFinalizedOrderForSlug(slug: string) {
  if (!slug || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ORDER_FINALIZED_KEY(slug));
  } catch {}
  try {
    window.sessionStorage.removeItem(ORDER_FINALIZED_KEY(slug));
  } catch {}
}

function minorToMajor(minor: number): number {
  const n = Number(minor || 0);
  return Math.round((n / 100) * 100) / 100;
}

function resolveShippingFromUser(user: LoggedInUser | null) {
  const u: any = user || {};
  const shipLine1 = (u.shipping_address_line1 || u.shippingAddressLine1 || "").trim();
  const shipCity = (u.shipping_city || u.shippingCity || "").trim();
  const shipPost = (u.shipping_postalcode || u.shippingPostalcode || "").trim();

  const hasShipping = !!shipLine1 || !!shipCity || !!shipPost || !!u.shipping_country;

  return {
    shipping_address_line1: hasShipping ? shipLine1 : (u.address_line1 || "").trim(),
    shipping_address_line2: hasShipping
      ? (u.shipping_address_line2 || u.shippingAddressLine2 || "").trim()
      : (u.address_line2 || "").trim(),
    shipping_city: hasShipping ? shipCity : (u.city || "").trim(),
    shipping_county: hasShipping
      ? (u.shipping_county || u.shippingCounty || "").trim()
      : (u.county || "").trim(),
    shipping_postalcode: hasShipping ? shipPost : (u.postalcode || "").trim(),
    shipping_country: hasShipping
      ? (u.shipping_country || u.shippingCountry || "").trim()
      : (u.country || "UK").trim(),
    shipping_is_different: hasShipping,
  };
}

/**
 * Build meta that is valid for an order across steps.
 * Includes: cart lines + totals + RAF snapshot + shipping snapshot.
 */
export function buildDraftOrderMeta(opts: {
  slug: string;
  serviceName?: string;
  cartItems: any[];
  userProfile?: LoggedInUser | null;
  currency?: string;
  appointmentIso?: string | null;
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
      qty,
      unitMinor,
      totalMinor,
      price: minorToMajor(unitMinor),
      line_total: minorToMajor(totalMinor),
      variation: variation || null,
      strength: ci.strength ?? null,
    };
  });

  const lines = items.map((it: any, index: number) => ({
    index,
    name: it.name,
    qty: it.qty,
    variation: it.variation || null,
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

  const rafQA = buildRafQAFromStorage(opts.slug);
  const rafFormId = readFirst([`raf_form_id.${opts.slug}`]) || null;

  const shipping = resolveShippingFromUser(opts.userProfile ?? null);

  const meta: any = {
    type: "new",
    currency,
    items,
    lines,

    subtotalMinor,
    feesMinor,
    totalMinor,

    subtotal: minorToMajor(subtotalMinor),
    fees: minorToMajor(feesMinor),
    total: minorToMajor(totalMinor),

    service_slug: opts.slug,
    service: opts.serviceName || opts.slug,

    ...(opts.appointmentIso ? { appointment_start_at: opts.appointmentIso } : {}),

    payment_status: "pending",

    ...shipping,

    formsQA: {
      raf: {
        form_id: rafFormId,
        schema_version: null,
        qa: rafQA,
      },
    },
  };

  if (items[0]) {
    const first = items[0];
    meta.selectedProduct = {
      name: first.name,
      variation: first.variation || null,
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

/** Best-effort schedule id resolver (optional) */
export async function ensureScheduleIdForSlug(slug: string): Promise<string | null> {
  const existing = readFirst([`schedule_id.${slug}`, "schedule_id", "pe_schedule_id", "scheduleId"]);
  if (existing) return existing;

  try {
    const sch: any = await fetchScheduleForServiceSlug(slug);
    const sid = sch?._id ? String(sch._id) : null;
    if (sid) {
      writeBoth(`schedule_id.${slug}`, sid);
      writeBoth("schedule_id", sid);
      return sid;
    }
  } catch {}

  return null;
}

export type EnsureDraftOrderInput = {
  slug: string;
  userId: string;
  serviceId: string;
  serviceName?: string;
  cartItems: any[];
  currency?: string;

  // appointment is OPTIONAL
  scheduleId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
};

/* -------------------- in-flight lock to prevent double create -------------------- */
function getLocks(): Record<string, Promise<string> | undefined> {
  const w = window as any;
  if (!w.__peEnsureSingleOrderLocks) w.__peEnsureSingleOrderLocks = {};
  return w.__peEnsureSingleOrderLocks as Record<string, Promise<string> | undefined>;
}

/** Lock key should NOT include serviceId (it can differ across steps and break the lock). */
function lockKey(i: EnsureDraftOrderInput) {
  return `${i.slug}::${i.userId}`;
}

/** ✅ robust 404 check (do NOT rely on message text) */
function is404(err: any) {
  const status =
    err?.status ||
    err?.response?.status ||
    err?.cause?.status ||
    err?.data?.statusCode ||
    err?.data?.status ||
    null;
  if (Number(status) === 404) return true;

  // fallback (only if your fetch wrapper throws plain messages)
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes(" 404 ") || msg.includes("status 404");
}

/**
 * Creates ONE order once, then only updates the same order in every step.
 * Also: if order is finalized, NEVER auto-create a new order.
 */
export async function ensureDraftOrder(input: EnsureDraftOrderInput): Promise<string> {
  if (!input.slug) throw new Error("Missing service slug.");
  if (!input.userId) throw new Error("Missing user id.");
  if (!input.serviceId) throw new Error("Missing service id.");
  if (!Array.isArray(input.cartItems) || input.cartItems.length === 0) {
    throw new Error("Basket is empty.");
  }

  // ✅ If finalized flag exists, never create a new order implicitly.
  const finalized = getFinalizedOrderForSlug(input.slug);
  const existingStored = getOrderIdForSlug(input.slug);
  if (finalized) {
    // prefer stored id, else use finalized value
    const id = existingStored || finalized;
    if (id) return id;
  }

  const locks = getLocks();
  const lk = lockKey(input);

  const existingJob = locks[lk];
  if (existingJob) return existingJob;

  const job = (async () => {
    const { slug, userId, serviceId, serviceName, cartItems } = input;

    const appointmentIso =
      input.startAt ||
      readFirst([
        "appointment_start_at",
        "appointment_at",
        "selected_appointment_at",
        "calendar_selected_at",
      ]);

    let userProfile: LoggedInUser | null = null;
    try {
      userProfile = await getLoggedInUserApi();
    } catch {
      userProfile = null;
    }

    const scheduleId =
      input.scheduleId ||
      readFirst([`schedule_id.${slug}`, "schedule_id", "pe_schedule_id", "scheduleId"]) ||
      (await ensureScheduleIdForSlug(slug));

    const meta = buildDraftOrderMeta({
      slug,
      serviceName,
      cartItems,
      userProfile,
      currency: input.currency || "GBP",
      appointmentIso: appointmentIso || null,
    });

    let orderId = getOrderIdForSlug(slug);

    // recover by reference
    if (!orderId) {
      const storedRef = getOrderRefForSlug(slug);
      if (storedRef) {
        try {
          const existingByRef = await fetchOrderByReferenceApi(storedRef);
          const foundId = existingByRef?._id || (existingByRef as any)?.id || null;
          if (foundId) {
            orderId = String(foundId);
            setOrderIdForSlug(slug, orderId);

            const backendRef =
              (existingByRef as any)?.reference ||
              (existingByRef as any)?.ref ||
              null;
            if (backendRef) setOrderRefForSlug(slug, String(backendRef));
          }
        } catch {
          // ignore
        }
      }
    }

    // UPDATE: do NOT send user_id/service_id again
    if (orderId) {
      const updatePayload: any = {
        meta,
        ...(scheduleId ? { schedule_id: scheduleId } : {}),
        ...(input.startAt ? { start_at: input.startAt } : {}),
        ...(input.endAt ? { end_at: input.endAt } : {}),
      };

      try {
        const updated: any = await updateOrderApi(orderId, updatePayload);

        const backendRef =
          updated?.reference || updated?.ref || (updated?.data?.reference ?? null);
        if (backendRef) setOrderRefForSlug(slug, String(backendRef));

        setOrderIdForSlug(slug, orderId);
        return orderId;
      } catch (err: any) {
        // ✅ only if TRUE 404 we allow create (deleted order id)
        if (is404(err)) {
          try {
            writeBoth(ORDER_ID_KEY(slug), "");
          } catch {}
          orderId = null;
        } else {
          // ✅ do NOT create a second order on other failures
          throw err;
        }
      }
    }

    // CREATE
    const createPayload: any = {
      user_id: userId,
      service_id: serviceId,
      order_type: "new",
      meta,
      payment_status: "pending",
      status: "pending",

      ...(scheduleId ? { schedule_id: scheduleId } : {}),
      ...(input.startAt ? { start_at: input.startAt } : {}),
      ...(input.endAt ? { end_at: input.endAt } : {}),
    };

    const created: any = await createOrderApi(createPayload);

    const newId = created && (created._id || created.id || created?.data?._id || created?.data?.id || null);
    if (!newId) throw new Error("Order created but no id returned.");

    const finalId = String(newId);
    setOrderIdForSlug(slug, finalId);

    const backendRef =
      created?.reference || created?.ref || created?.data?.reference || null;
    if (backendRef) setOrderRefForSlug(slug, String(backendRef));

    return finalId;
  })();

  locks[lk] = job;

  try {
    return await job;
  } finally {
    if (locks[lk] === job) delete locks[lk];
  }
}
