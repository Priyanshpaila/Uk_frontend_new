// lib/api.ts
import type { Service } from "./types";
import { notFound } from "next/navigation";

// Helper function to check if the host is an IP
const isIp = (host: string) => /^\d+\.\d+\.\d+\.\d+$/.test(host);

// Helper function to strip protocol (e.g., http:// or https://)
const stripProtocol = (url: string) => url.replace(/^https?:\/\//, "");

// ENV variables
const ENV_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ""; // e.g. http://localhost:8000/api
const ENV_BASE_ONLY_URL = process.env.NEXT_PUBLIC_ONLY_URL || ""; // e.g. backend.domain.com/api

/**
 * Returns the backend base URL for the *current tenant*.
 * For localhost/IP → use ENV_BASE_URL / ENV_BASE_ONLY_URL.
 * For tenant.domain.tld → computes tenant-based URL using ONLY_URL.
 */
export function getBackendBase(): string {
  if (typeof window === "undefined") {
    // SSR fallback – no subdomain awareness here, but we use protocol dynamically
    const { protocol, hostname } = new URL(process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000/api");
    const parts = hostname.split(".");
    const hasSubdomain = parts.length >= 4;

    if (hasSubdomain) {
      const subdomain = parts[0].toLowerCase();
      const baseOnly = stripProtocol(ENV_BASE_ONLY_URL || "localhost:8000/api");
      return `${protocol}//${subdomain}.${baseOnly}`;  // Use dynamic protocol here
    }

    return `${protocol}//${ENV_BASE_ONLY_URL}`; // Use dynamic protocol for fallback
  }

  // On the client side (browser)
  const { protocol, hostname } = window.location;

  // If we're on localhost or an IP, treat as "no subdomain"
  if (hostname === "localhost" || isIp(hostname)) {
    return resolveBaseForNoSubdomain(protocol);
  }

  // Split hostname to check for subdomain
  const parts = hostname.split(".");

  // For this project you want length >= 2 to count as "has subdomain"
  const hasSubdomain = parts.length >= 4;

  if (!hasSubdomain) {
    return resolveBaseForNoSubdomain(protocol);
  }

  // Subdomain case: tenant.domain.tld -> "tenant"
  const subdomain = parts[0].toLowerCase();

  // Get the base URL from env (WITHOUT protocol) or fallback
  const baseOnly = stripProtocol(ENV_BASE_ONLY_URL || "localhost:8000/api");

  // Example: http://tenant.backend.pharma-health.co.uk/api
  return `${protocol}//${subdomain}.${baseOnly}`;
}

/**
 * Handle base URL when there is *no* tenant subdomain.
 */
function resolveBaseForNoSubdomain(protocol: string): string {
  if (ENV_BASE_URL) {
    // Already a full URL like http://localhost:8000/api
    return ENV_BASE_URL;
  }

  if (ENV_BASE_ONLY_URL) {
    return `${protocol}//${stripProtocol(ENV_BASE_ONLY_URL)}`;
  }

  // Default fallback (shouldn't be hit in production)
  return `${protocol}//localhost:8000/api`;
}

/**
 * Base URL for "master" backend (no tenant subdomain).
 */
export function getMasterBase(): string {
  return ENV_BASE_URL || "http://localhost:8000/api";
}

/**
 * Constant base used where tenant-awareness is not needed (or on server).
 * For page slugs etc.
 */
export const API_BASE = getBackendBase();
const url = getBackendBase();
console.log("Backend base URL:", url);

/* ------------------------------------------------------------------ */
/*                         AUTH HEADER + FETCH                        */
/* ------------------------------------------------------------------ */

/**
 * Reads whatever token you use in localStorage and returns Authorization header.
 * Supports multiple key names so old/new flows all work.
 */
function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};

  try {
    const ls = window.localStorage;
    const token =
      ls.getItem("session_token") ||
      ls.getItem("pharmacy_token") ||
      ls.getItem("pe_token") ||
      ls.getItem("token");

    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

/**
 * Generic JSON fetch:
 * - Always sets "Content-Type: application/json"
 * - Automatically adds Bearer token from localStorage (if present)
 */
async function jsonFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeader = getAuthHeader();

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Same as jsonFetch, but takes only a path and prepends getBackendBase().
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBackendBase();
  return jsonFetch<T>(`${baseUrl}${path}`, options);
}

/* ------------------------------------------------------------------ */
/*                        PATIENT REGISTER / LOGIN                    */
/* ------------------------------------------------------------------ */

export type RegisterPatientPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;

  gender: string;
  phone: string;
  email_verified?: boolean; // optional – default to false if not provided
  dob: string; // "YYYY-MM-DD"

  address_line1: string;
  address_line2?: string;
  city: string;
  county: string;
  postalcode: string;
  country: string;

  // ✅ NEW: Shipping address (optional)
  use_alt_delivery?: boolean; // if true, use shipping_* instead of home address
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_county?: string;
  shipping_postalcode?: string;
  shipping_country?: string;
};

/**
 * POST /auth/register
 * Always sends `is_patient: true` in the body.
 */
export async function registerPatientApi(payload: RegisterPatientPayload) {
  const base = getBackendBase();

  const hasShipping =
    !!payload.use_alt_delivery ||
    !!payload.shipping_address_line1 ||
    !!payload.shipping_address_line2 ||
    !!payload.shipping_city ||
    !!payload.shipping_county ||
    !!payload.shipping_postalcode ||
    !!payload.shipping_country;

  const body: any = {
    ...payload,
    email_verified: payload.email_verified ?? false,
    is_patient: true,
  };

  // ✅ Add a single object too (backend can consume either flat fields or object)
  if (hasShipping) {
    body.shipping_address = {
      address_line1: payload.shipping_address_line1 || "",
      address_line2: payload.shipping_address_line2 || "",
      city: payload.shipping_city || "",
      county: payload.shipping_county || "",
      postalcode: payload.shipping_postalcode || "",
      country: payload.shipping_country || "United Kingdom",
    };
  }

  return jsonFetch<any>(`${base}/auth/register`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* ------------------- Login API ------------------- */

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  session_token: string;
  user: any; // replace with your actual user type later
};

/**
 * POST /auth/login
 */
export async function loginApi(payload: LoginPayload): Promise<LoginResponse> {
  const base = getBackendBase();

  return jsonFetch<LoginResponse>(`${base}/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
    }),
  });
}

/* ------------------------------------------------------------------ */
/*                           SERVICES LIST                             */
/* ------------------------------------------------------------------ */

type BackendService = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  cta_text?: string;
  image?: string;
  status?: string;
  active?: boolean;
  view_type?: string;
  [key: string]: any;
};

type ServicesResponse =
  | {
      data: BackendService[];
      meta?: {
        total: number;
        page: number;
        limit: number;
        pages: number;
      };
    }
  | BackendService[];

// helper to build full image URL from relative path
function buildServiceImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;

  // already absolute
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // e.g. getBackendBase() = http://localhost:8000/api
  const base = getBackendBase();
  const root = base.replace(/\/api\/?$/, ""); // -> http://localhost:8000

  if (imagePath.startsWith("/")) return `${root}${imagePath}`;
  return `${root}/${imagePath}`;
}

/**
 * Fetch services for the landing page: GET /services
 */
export async function fetchServices(): Promise<Service[]> {
  const base = getBackendBase();
  const raw = await jsonFetch<ServicesResponse>(`${base}/services`, {
    method: "GET",
    cache: "no-store",
  });

  const items: BackendService[] = Array.isArray(raw) ? raw : raw.data || [];

  return items.map((item) => ({
    id: item._id,
    name: item.name,
    slug: item.slug,
    description:
      item.description ||
      "This service is available at Pharmacy Express. Learn more.",
    ctaText: item.cta_text || "Book now",
    image: buildServiceImageUrl(item.image),
    status: item.status ?? "published",
    active: item.active ?? true,
    viewType: item.view_type ?? "card",
  }));
}

/* ------------------------------------------------------------------ */
/*                         USER / PROFILE APIs                        */
/* ------------------------------------------------------------------ */

export type LoggedInUser = {
  _id: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  dob?: string;

  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postalcode?: string;
  country?: string;

  // ✅ NEW: Shipping / delivery address (optional)
  use_alt_delivery?: boolean;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_county?: string;
  shipping_postalcode?: string;
  shipping_country?: string;

  // (optional) if backend returns nested object, keep it too
  shipping_address?: {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    county?: string;
    postalcode?: string;
    country?: string;
  };

  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

// backend might return just the user object, or { user: ... }
type MeResponse = LoggedInUser | { user: any };

/**
 * GET /users/me
 * Normalizes backend shape into a consistent LoggedInUser.
 */
export async function getLoggedInUserApi(): Promise<LoggedInUser> {
  const base = getBackendBase();

  const data = await jsonFetch<MeResponse | any>(`${base}/users/me`, {
    method: "GET",
  });

  console.log("Fetched user data from /users/me:", data);

  const raw: any = (data as any).user ?? data;
  const ship =
    raw.shipping_address ?? raw.delivery_address ?? raw.delivery ?? {};

  const fullName: string = raw.name ?? "";
  const [firstFromName, ...restName] = fullName.split(" ").filter(Boolean);

  const loggedInUser: LoggedInUser = {
    _id: raw._id ?? raw.id ?? "",
    firstName: raw.firstName ?? raw.first_name ?? firstFromName ?? "",
    lastName:
      raw.lastName ??
      raw.last_name ??
      (restName.length ? restName.join(" ") : ""),
    gender: raw.gender ?? raw.sex ?? "",
    email: raw.email ?? "",
    phone: raw.phone ?? raw.mobile ?? "",
    dob: raw.dob ?? raw.dateOfBirth ?? undefined,

    address_line1:
      raw.address_line1 ?? raw.address1 ?? raw.address_line_1 ?? "",
    address_line2:
      raw.address_line2 ?? raw.address2 ?? raw.address_line_2 ?? "",
    city: raw.city ?? "",
    county: raw.county ?? raw.state ?? "",
    postalcode: raw.postalcode ?? raw.postcode ?? raw.zip ?? "",
    country: raw.country ?? "United Kingdom",

    use_alt_delivery:
      raw.use_alt_delivery ??
      raw.useAltDelivery ??
      raw.use_alt_delivery_address ??
      false,

    shipping_address_line1:
      raw.shipping_address_line1 ??
      raw.delivery_address1 ??
      raw.delivery_address_line1 ??
      ship.address_line1 ??
      ship.address1 ??
      "",

    shipping_address_line2:
      raw.shipping_address_line2 ??
      raw.delivery_address2 ??
      raw.delivery_address_line2 ??
      ship.address_line2 ??
      ship.address2 ??
      "",

    shipping_city: raw.shipping_city ?? raw.delivery_city ?? ship.city ?? "",

    shipping_county:
      raw.shipping_county ??
      raw.delivery_county ??
      raw.delivery_state ??
      ship.county ??
      ship.state ??
      "",

    shipping_postalcode:
      raw.shipping_postalcode ??
      raw.delivery_postcode ??
      raw.delivery_postalcode ??
      ship.postalcode ??
      ship.postcode ??
      ship.zip ??
      "",

    shipping_country:
      raw.shipping_country ??
      raw.delivery_country ??
      ship.country ??
      "United Kingdom",

    shipping_address: raw.shipping_address ?? undefined,

    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  return loggedInUser;
}

/* ---------- Patient profile: update /users/:id ---------- */

export type UpdatePatientPayload = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  phone?: string;
  dob?: string; // ISO string "YYYY-MM-DD" or full ISO
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postalcode?: string;
  country?: string;
  use_alt_delivery?: boolean;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_county?: string;
  shipping_postalcode?: string;
  shipping_country?: string;
};

/**
 * PUT /users/:id
 * Sends both camelCase and snake_case so backend is always happy.
 */
export async function updatePatientApi(
  userId: string,
  payload: UpdatePatientPayload
): Promise<LoggedInUser> {
  const base = getBackendBase();

  const bodyToSend: any = {
    ...payload,
  };

  // snake_case mapping
  if (payload.firstName !== undefined) {
    bodyToSend.first_name = payload.firstName;
  }
  if (payload.lastName !== undefined) {
    bodyToSend.last_name = payload.lastName;
  }

  // combined "name" field for older schemas
  if (payload.firstName !== undefined || payload.lastName !== undefined) {
    const first = payload.firstName ?? "";
    const last = payload.lastName ?? "";
    const name = `${first} ${last}`.trim();
    if (name) bodyToSend.name = name;
  }

  if (payload.use_alt_delivery !== undefined) {
    bodyToSend.use_alt_delivery = payload.use_alt_delivery;
  }

  if (payload.shipping_address_line1 !== undefined) {
    bodyToSend.shipping_address_line1 = payload.shipping_address_line1;
    bodyToSend.delivery_address1 = payload.shipping_address_line1; // legacy alias (optional)
  }
  if (payload.shipping_address_line2 !== undefined) {
    bodyToSend.shipping_address_line2 = payload.shipping_address_line2;
    bodyToSend.delivery_address2 = payload.shipping_address_line2; // legacy alias (optional)
  }
  if (payload.shipping_city !== undefined) {
    bodyToSend.shipping_city = payload.shipping_city;
    bodyToSend.delivery_city = payload.shipping_city; // legacy alias (optional)
  }
  if (payload.shipping_county !== undefined) {
    bodyToSend.shipping_county = payload.shipping_county;
    bodyToSend.delivery_county = payload.shipping_county; // legacy alias (optional)
  }
  if (payload.shipping_postalcode !== undefined) {
    bodyToSend.shipping_postalcode = payload.shipping_postalcode;
    bodyToSend.delivery_postcode = payload.shipping_postalcode; // legacy alias (optional)
  }
  if (payload.shipping_country !== undefined) {
    bodyToSend.shipping_country = payload.shipping_country;
    bodyToSend.delivery_country = payload.shipping_country; // legacy alias (optional)
  }

  // Also send a single nested object if any shipping field is present (optional but useful)
  const hasShipping =
    payload.use_alt_delivery ||
    payload.shipping_address_line1 ||
    payload.shipping_address_line2 ||
    payload.shipping_city ||
    payload.shipping_county ||
    payload.shipping_postalcode ||
    payload.shipping_country;

  if (hasShipping) {
    bodyToSend.shipping_address = {
      address_line1: payload.shipping_address_line1 || "",
      address_line2: payload.shipping_address_line2 || "",
      city: payload.shipping_city || "",
      county: payload.shipping_county || "",
      postalcode: payload.shipping_postalcode || "",
      country: payload.shipping_country || "United Kingdom",
    };
  }

  return jsonFetch<LoggedInUser>(`${base}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(bodyToSend),
  });
}

/* ---------- Patient password: POST /users/changePassword/:id ---------- */

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export async function changePasswordApi(
  userId: string,
  payload: ChangePasswordPayload
): Promise<any> {
  const base = getBackendBase();

  return jsonFetch<any>(`${base}/users/changePassword/${userId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ------------------------------------------------------------------ */
/*                              ORDERS                                */
/* ------------------------------------------------------------------ */

export type OrderLine = {
  index: number;
  name: string;
  qty: number;
  variation?: string | null;

  // ✅ keep minor (canonical)
  unitMinor: number; // e.g. £12.34 => 1234
  totalMinor: number; // unitMinor * qty

  // ✅ add major (ready to display)
  price: number; // unit price in major units (e.g. 12.34)
  line_total: number; // line total in major units (e.g. 24.68)

  sku?: string;
};

export type OrderMeta = {
  lines?: OrderLine[];

  // ✅ keep minor (canonical)
  subtotalMinor?: number;
  feesMinor?: number;
  totalMinor?: number;

  // ✅ add major (ready to display)
  subtotal?: number; // major units
  fees?: number; // major units
  total?: number; // major units

  currency?: string; // e.g. "GBP"

  service_slug?: string;
  service?: string;
  appointment_start_at?: string;
  payment_status?: string;

  [key: string]: any;
};

export type OrderDto = {
  _id: string;
  user_id: string;
  reference: string;
  status: string;
  payment_status: string;
  service_id?: string;
  schedule_id?: string;
  appointment_status?: string;
  is_appointment_booked?: boolean;

  first_name?: string;
  last_name?: string;
  email?: string;

  start_at?: string;
  end_at?: string;

  patient_name?: string;
  service_slug?: string;
  service_name?: string;

  createdAt?: string;
  updatedAt?: string;

  meta?: OrderMeta;
};

export type OrdersListMeta = {
  total: number;
  page: number;
  limit: number;
  pages?: number; // backend might use this
  totalPages?: number; // or this
};

export type OrdersListResponse = {
  data: OrderDto[];
  meta: OrdersListMeta;
};

/**
 * GET /orders?user_id=...&page=&limit=
 */
export async function getUserOrdersApi(
  userId: string,
  page = 1,
  limit = 20
): Promise<OrdersListResponse> {
  const params = new URLSearchParams({
    user_id: userId,
    page: String(page),
    limit: String(limit),
  });

  return apiFetch<OrdersListResponse>(`/orders?${params.toString()}`, {
    method: "GET",
  });
}

/**
 * POST /orders
 */
export type CreateOrderPayload = {
  user_id: string;
  schedule_id: string;
  service_id: string;
  reference: string;
  start_at: string;
  end_at: string;
  meta?: OrderMeta;
  payment_status?: string;
  order_type?: string; // optional, defaults to "new"
};

export async function createOrderApi(
  payload: CreateOrderPayload
): Promise<OrderDto> {
  const base = getBackendBase();

  // Ensure we always send order_type: "new" by default
  const bodyToSend: any = { ...payload };
  if (!bodyToSend.order_type) bodyToSend.order_type = "new";

  return jsonFetch<OrderDto>(`${base}/orders`, {
    method: "POST",
    body: JSON.stringify(bodyToSend),
  });
}

/**
 * PUT /orders/:id
 */
export type UpdateOrderPayload = Partial<CreateOrderPayload> & {
  status?: string;
  appointment_status?: string;
  is_appointment_booked?: boolean;
};

export async function updateOrderApi(
  orderId: string,
  payload: UpdateOrderPayload
): Promise<OrderDto> {
  const base = getBackendBase();
  return jsonFetch<OrderDto>(`${base}/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * GET /orders/:id
 */
export async function getOrderByIdApi(orderId: string): Promise<OrderDto> {
  const base = getBackendBase();

  return jsonFetch<OrderDto>(`${base}/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
}

/* ------------------------------------------------------------------ */
/*                               PAGES                                */
/* ------------------------------------------------------------------ */

export type Page = {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  template?: string;
  visibility?: string;
  active?: boolean;
  meta_title?: string;
  meta_description?: string;
  meta?: {
    background?: {
      enabled?: boolean;
      background_upload?: string;
      url?: string | null;
      blur?: number | null;
      overlay?: number | null;
    } | null;
  } | null;
  status?: string;
  content?: string;
  rendered_html?: string;
  gallery?: string[];
  service_id?: string;
};

/**
 * Fetch a page by slug from: GET /pages/slug/:slug
 */
export async function fetchPageBySlug(slug: string): Promise<Page> {
  if (!API_BASE) {
    throw new Error("Missing base URL");
  }

  const res = await fetch(
    `${API_BASE}/pages/slug/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
      next: { revalidate: 0 },
      headers: {
        ...getAuthHeader(),
      },
    }
  );

  if (res.status === 404) {
    notFound(); // Next.js 404 page
  }

  if (!res.ok) {
    throw new Error(`Page fetch failed ${res.status}`);
  }

  return res.json();
}

/* ------------------------------------------------------------------ */
/*                         SERVICE DETAIL BY SLUG                     */
/* ------------------------------------------------------------------ */

export type ServiceDetail = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  // backend-style
  booking_flow?: string | null;
  reorder_flow?: string | null;
  forms_assignment?: string | null;
  // frontend-friendly aliases
  bookingFlow?: string | null;
  reorderFlow?: string | null;
  formsAssignment?: string | null;
  status?: string;
  active?: boolean;
  view_type?: string;
  cta_text?: string;
  image?: string | null;
  service_type?: string | null;
  serviceType?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

type BackendServiceDetail = BackendService & {
  booking_flow?: string | null;
  reorder_flow?: string | null;
  forms_assignment?: string | null;
  service_type?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * GET /services/slug/:slug
 */
export async function fetchServiceBySlug(slug: string): Promise<ServiceDetail> {
  const base = getBackendBase();

  const raw = await jsonFetch<BackendServiceDetail>(
    `${base}/services/slug/${encodeURIComponent(slug)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  const description =
    raw.description ||
    "This service is available at Pharmacy Express. Learn more.";

  const image = buildServiceImageUrl(raw.image);

  const serviceDetail: ServiceDetail = {
    _id: raw._id,
    name: raw.name,
    slug: raw.slug,
    description,
    cta_text: raw.cta_text || "Book",
    image,
    status: raw.status ?? "published",
    active: raw.active ?? true,
    view_type: raw.view_type ?? "card",
    appointment_medium: raw.appointment_medium ?? null,

    // backend snake_case
    booking_flow: raw.booking_flow ?? null,
    reorder_flow: raw.reorder_flow ?? null,
    forms_assignment: raw.forms_assignment ?? null,
    service_type: raw.service_type ?? null,

    // frontend camelCase aliases
    bookingFlow: raw.booking_flow ?? null,
    reorderFlow: raw.reorder_flow ?? null,
    formsAssignment: raw.forms_assignment ?? null,
    serviceType: raw.service_type ?? null,

    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };

  return serviceDetail;
}

/* ------------------------------------------------------------------ */
/*                        SERVICE MEDICINES APIs                      */
/* ------------------------------------------------------------------ */

// lib/api.ts  (service medicines section)

// Variation as it comes from backend
export type MedicineVariationDto = {
  title: string;
  price: number; // assumed in major units (e.g. 12.5 => £12.50)
  stock: number;
  min_qty?: number;
  max_qty?: number;
  sort_order?: number;
  status?: string; // "published" | "draft" | "active" etc.
};

export type ServiceMedicineDto = {
  _id: string;
  sku: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  status?: string | null; // "published", "draft", etc.
  price_from?: number; // lowest variation price
  max_bookable_quantity?: number;
  allow_reorder?: boolean;
  is_virtual?: boolean;

  // NEW: array of variation objects (preferred)
  variations?: MedicineVariationDto[];

  // Legacy / optional fields kept for safety
  qty?: number;
  unitMinor?: number;
  totalMinor?: number;
  strength?: string;
  variation?: string;
  min?: number;
  max?: number;
  min_qty?: number;
  max_qty?: number;
  [key: string]: any;
};

/**
 * GET /service-medicines/service/:serviceId
 */
export async function fetchServiceMedicinesByServiceId(
  serviceId: string
): Promise<ServiceMedicineDto[]> {
  const base = getBackendBase();
  return jsonFetch<ServiceMedicineDto[]>(
    `${base}/service-medicines/service/${encodeURIComponent(serviceId)}`,
    {
      method: "GET",
    }
  );
}

/**
 * Generic media URL builder for ANY backend image.
 */
export function buildMediaUrl(imagePath?: string | null): string {
  if (!imagePath) return "/images/product-placeholder.svg";

  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  const base = getBackendBase();
  const origin = base.replace(/\/api\/?$/, ""); // http://host:8000

  if (imagePath.startsWith("/")) return `${origin}${imagePath}`;
  return `${origin}/${imagePath}`;
}

/* ------------------------------------------------------------------ */
/*                            RAF / Clinic Forms                      */
/* ------------------------------------------------------------------ */

export type ClinicFormDto = {
  _id: string;
  name?: string;
  description?: string;
  form_type?: string;
  is_active?: boolean;
  raf_status?: string;
  service_id?: string;
  service_slug?: string;
  schema?: any;
  raf_schema?: any;
  questions?: any;
};

/**
 * GET /clinic-forms
 * Returns either { data: ClinicFormDto[] } or a plain array.
 */
export async function fetchClinicForms(): Promise<ClinicFormDto[]> {
  const base = getBackendBase();
  const raw = await jsonFetch<any>(`${base}/clinic-forms`, {
    method: "GET",
  });

  if (Array.isArray(raw?.data)) return raw.data as ClinicFormDto[];
  if (Array.isArray(raw)) return raw as ClinicFormDto[];
  return [];
}

/**
 * Convenience helper:
 *  - finds the active RAF form for a service (by slug or serviceId)
 *  - then loads the full form by id to get the schema
 *  - returns a normalised ClinicFormDto (compatible with ApiClinicForm)
 */
export async function fetchRafFormForService(
  serviceSlug: string,
  serviceId?: string | null
): Promise<ClinicFormDto | null> {
  const base = getBackendBase();

  const forms = await fetchClinicForms();

  const candidates = forms.filter((f) => {
    const matchesSlug =
      f.service_slug && String(f.service_slug) === String(serviceSlug);
    const matchesId =
      serviceId && f.service_id && String(f.service_id) === String(serviceId);
    const isRaf = (f.form_type || "").toLowerCase() === "raf";
    const isActive = f.is_active !== false;
    return (matchesSlug || matchesId) && isRaf && isActive;
  });

  const picked = candidates[0];
  if (!picked?._id) return null;

  const detail = await jsonFetch<ClinicFormDto>(
    `${base}/clinic-forms/${encodeURIComponent(picked._id)}`,
    {
      method: "GET",
    }
  );

  // Normalise schema so callers can always use `form.schema`
  const bestSchema =
    detail.schema ?? detail.raf_schema ?? detail.questions ?? null;

  return {
    ...detail,
    schema: bestSchema,
  };
}

export async function fetchClinicFormByIdApi(formId: string) {
  const base = getBackendBase(); // use your existing helper
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token") ||
        localStorage.getItem("pe_session_token") ||
        localStorage.getItem("token") ||
        ""
      : "";

  // try a few common routes (keep the one that matches your backend)
  const candidates = [
    `${base}/clinicForms/${formId}`,
    `${base}/clinic-forms/${formId}`,
    `${base}/clinic_forms/${formId}`,
  ];

  let lastErr: any = null;

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} for ${url}`);
        continue;
      }

      const json = await res.json();
      return json;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Failed to fetch clinic form by id.");
}

/* ------------------------------------------------------------------ */
/*                  Consultation session + RAF answers                */
/* ------------------------------------------------------------------ */

/**
 * POST /consultations/sessions
 * Body: { service_slug }
 * Returns the numeric session id (or null if it can't be created).
 */
export async function createConsultationSessionApi(
  serviceSlug: string
): Promise<number | null> {
  const base = getBackendBase();

  const data = await jsonFetch<any>(`${base}/consultations/sessions`, {
    method: "POST",
    body: JSON.stringify({ service_slug: serviceSlug }),
  });

  const sid = Number(data?.session_id ?? data?.id);
  return Number.isFinite(sid) && sid > 0 ? sid : null;
}

/**
 * POST /consultations/:id/answers
 * Saves RAF answers for the given consultation session.
 */
export async function saveRafAnswersApi(
  sessionId: number,
  slug: string,
  answers: Record<string, any>
): Promise<void> {
  const base = getBackendBase();

  await jsonFetch<any>(
    `${base}/consultations/${encodeURIComponent(String(sessionId))}/answers`,
    {
      method: "POST",
      body: JSON.stringify({
        form_type: "raf",
        service_slug: slug,
        session_id: sessionId,
        answers,
      }),
    }
  );
}

/* ------------------------------------------------------------------ */
/*                           RAF file upload                          */
/* ------------------------------------------------------------------ */

export type IntakeUploadResult = {
  ok: boolean;
  url?: string;
  path?: string;
  message?: string;
};

/**
 * POST /uploads/intake-image
 * Uses FormData (so we DON'T use jsonFetch here).
 */
export async function uploadRafFile(
  file: File,
  kind: string = "raf"
): Promise<IntakeUploadResult> {
  const base = getBackendBase();
  const tokenHeader = getAuthHeader();

  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);

  const res = await fetch(`${base}/uploads/intake-image`, {
    method: "POST",
    headers: {
      // IMPORTANT: do NOT set Content-Type here, browser will set multipart boundary
      ...tokenHeader,
    },
    body: fd,
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok || data?.ok !== true) {
    return {
      ok: false,
      message: data?.message || `Upload failed (${res.status})`,
    };
  }

  return {
    ok: true,
    url: data.url,
    path: data.path,
  };
}

/* ------------------------------------------------------------------ */
/*                  Calendar / Schedules & Slots                      */
/* ------------------------------------------------------------------ */

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type WeekConfig = {
  day: WeekDay;
  open: boolean;
  start: string | null; // "09:00"
  end: string | null; // "17:00"
  break_start: string | null; // "12:30"
  break_end: string | null; // "13:00"
};

export type OverrideConfig = {
  date: string; // "YYYY-MM-DD"
  open: boolean;
  start: string | null;
  end: string | null;
  note?: string | null;
};

export type Schedule = {
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

export type Slot = {
  time: string;
  start_at: string; // ISO
  available: boolean;
  remaining: number;
};

export type DayMeta = {
  open: boolean;
  hasOverride?: boolean;
  start?: string;
  end?: string;
  overrideNote?: string;
  reason?: string;
};

type SchedulesResponse = { data: Schedule[]; meta?: any } | Schedule[];

// Small date helpers re-usable in calendar UIs
export function dateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatYmdForDisplay(
  yyyyMmDd: string,
  locale = "en-GB"
): string {
  const d = new Date(yyyyMmDd + "T00:00:00");
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

/**
 * Fetch schedules and pick one matching a service slug
 */
/**
 * Fetch schedules and pick one matching a service slug
 */
export async function fetchScheduleForServiceSlug(
  serviceSlug: string
): Promise<Schedule> {
  const base = getBackendBase();

  const raw = await jsonFetch<SchedulesResponse>(`${base}/schedules`, {
    method: "GET",
    cache: "no-store",
  });

  const list: Schedule[] = Array.isArray(raw) ? raw : raw.data || [];

  const match = list.find((s) => s.service_slug === serviceSlug) || list[0];

  if (!match) {
    throw new Error("No schedule configured for this service yet.");
  }

  // Persist schedule_id + service_id so other flows (order / appointment) can reuse them
  try {
    if (typeof window !== "undefined") {
      if (match._id) {
        window.localStorage.setItem("schedule_id", match._id);
        window.sessionStorage.setItem("schedule_id", match._id);
      }
      if (match.service_id) {
        window.localStorage.setItem("service_id", String(match.service_id));
        window.sessionStorage.setItem("service_id", String(match.service_id));
      }
    }
  } catch {
    // ignore storage issues
  }

  return match;
}

// ---- Slot building logic (pure) ----

const CAL_DAY_MAP: WeekDay[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

function toMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

export function buildSlotsForDate(
  schedule: Schedule,
  yyyyMmDd: string
): { slots: Slot[]; meta: DayMeta } {
  const js = new Date(yyyyMmDd + "T00:00:00");
  if (Number.isNaN(js.getTime())) {
    return {
      slots: [],
      meta: { open: false, reason: "Invalid date" },
    };
  }

  const dayKey = CAL_DAY_MAP[js.getDay()];
  const meta: DayMeta = { open: false };

  // Weekly config
  const weekCfg = schedule.week?.find((w) => w.day === dayKey) || null;
  if (!weekCfg || !weekCfg.open) {
    meta.open = false;
    meta.reason = "Closed on this weekday";
  }

  let start = weekCfg?.start ?? null;
  let end = weekCfg?.end ?? null;
  let breakStart = weekCfg?.break_start ?? null;
  let breakEnd = weekCfg?.break_end ?? null;

  // Overrides
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
    const iso = `${yyyyMmDd}T${timeLabel}:00Z`; // treated as UTC

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

/* ------------------------------------------------------------------ */
/*              Appointment + RAF Answers Storage Helpers             */
/* ------------------------------------------------------------------ */

function splitIsoToParts(iso: string): { date: string; time: string } {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (m) return { date: m[1], time: m[2] };

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };

  const date = dateToYmd(d);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { date, time };
}

export function persistAppointmentSelection(
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
      window.localStorage.setItem("appointment_at", iso);
      window.sessionStorage.setItem("appointment_at", iso);

      if (date) {
        window.localStorage.setItem("appointment_date", date);
        window.sessionStorage.setItem("appointment_date", date);
      }
      if (time) {
        window.localStorage.setItem("appointment_time", time);
        window.sessionStorage.setItem("appointment_time", time);
      }
      if (opts?.label) {
        window.localStorage.setItem("appointment_time_label", opts.label);
      }
      window.localStorage.setItem("appointment_pretty", pretty);

      if (opts?.serviceSlug) {
        window.localStorage.setItem("service_slug", opts.serviceSlug);
        window.sessionStorage.setItem("service_slug", opts.serviceSlug);
      }
    }
  } catch {
    // ignore
  }
}

export type StoredUser = {
  userId?: string;
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dob?: string;
  [key: string]: any;
};

export function getStoredUserFromStorage(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem("user") ||
      window.localStorage.getItem("pharmacy_user") ||
      window.localStorage.getItem("user_data") ||
      window.localStorage.getItem("pe_user") ||
      window.localStorage.getItem("pe.user");
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function getServiceIdFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.localStorage.getItem("service_id") ||
      window.sessionStorage.getItem("service_id");
    return raw ? String(raw) : null;
  } catch {
    return null;
  }
}
export function getConsultationSessionIdFromStorage(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = [
      "consultation_session_id",
      "pe_consultation_session_id",
      "consultationSessionId",
    ];
    for (const k of keys) {
      const raw =
        window.localStorage.getItem(k) ||
        window.sessionStorage.getItem(k) ||
        "";
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // ignore
  }
  return null;
}

export function readRafAnswersFromStorage(
  slug: string
): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  try {
    const keys = [
      `raf_answers.${slug}`,
      `raf.answers.${slug}`,
      `assessment.answers.${slug}`,
    ];
    for (const k of keys) {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function buildRafQAFromStorage(slug: string): any[] {
  const answers = readRafAnswersFromStorage(slug);
  if (!answers) return [];

  // 🔥 Try to read label map written by RafStep
  let labelMap: Record<string, { label?: string; key?: string }> | null = null;

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(`raf_labels.${slug}`);
      if (raw) {
        labelMap = JSON.parse(raw);
      }
    } catch {
      // ignore
    }
  }

  const out: any[] = [];

  Object.entries(answers).forEach(([fieldKey, value]) => {
    if (value === undefined || value === null || value === "") return;

    const meta = labelMap?.[fieldKey] ?? null;
    const friendlyKey = meta?.key || fieldKey;
    const questionLabel = meta?.label || fieldKey; // fallback if no labels stored

    const answer = Array.isArray(value)
      ? value.map((v) => String(v)).join(", ")
      : String(value);

    out.push({
      key: friendlyKey, // e.g. "meds_current"
      question: questionLabel, // e.g. "Are you on any current medications?"
      answer,
      raw: value,
    });
  });

  return out;
}

export function resolveUserIdFromStorage(
  currentUser?: { _id?: string } | null
): string | null {
  const stored = getStoredUserFromStorage();
  const fromStored = stored?.userId || stored?._id || stored?.id || null;
  if (fromStored) return String(fromStored);
  if (currentUser?._id) return String(currentUser._id);
  return null;
}

/* ------------------------------------------------------------------ */
/*                          Cart + payments                           */
/* ------------------------------------------------------------------ */

export type CartItem = {
  sku: string;
  name: string;
  qty: number;
  price?: number; // in pounds
  priceMinor?: number; // in minor units (pence)
  unitMinor?: number;
  totalMinor?: number;
  label?: string; // variation label
};

export type CartTotals = {
  lines: CartItem[];
  subtotalMinor: number;
  feesMinor: number;
  totalMinor: number;
};

export type LastPaymentItem = {
  sku: string;
  name: string;
  variations: string | null;
  qty: number;
  unitMinor: number;
  totalMinor: number;
};

export type LastPaymentPayload = {
  ref: string;
  amountMinor: number; // canonical field
  totalMinor?: number; // alias for convenience
  ts: number;
  slug: string;
  appointment_at: string | null;
  sessionId?: string;
  items: LastPaymentItem[];
};

export function makeRefFromSlug(slug: string): string {
  const cleaned = (slug || "").replace(/[^a-zA-Z]+/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);

  let letters = tokens
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  if (letters.length < 2 && tokens[0]) {
    letters = tokens[0].slice(0, 2).toUpperCase();
  }
  if (letters.length < 2) letters = "AA";

  const num = String(Date.now()).slice(-6);
  return `P${letters}${num}`;
}

export function computeCartTotals(lines: CartItem[]): CartTotals {
  let subtotalMinor = 0;

  const normalised = (lines || []).map((it) => {
    const unit = Number.isFinite(it.unitMinor)
      ? (it.unitMinor as number)
      : Number.isFinite(it.priceMinor)
      ? (it.priceMinor as number)
      : Math.round(((it.price ?? 0) as number) * 100);

    const total =
      Number.isFinite(it.totalMinor) && (it.totalMinor as number) > 0
        ? (it.totalMinor as number)
        : unit * (it.qty || 1);

    subtotalMinor += total;

    return {
      ...it,
      unitMinor: unit,
      totalMinor: total,
    };
  });

  const feesMinor = 0;
  const totalMinor = subtotalMinor + feesMinor;

  return {
    lines: normalised,
    subtotalMinor,
    feesMinor,
    totalMinor,
  };
}

/* ------------------------------------------------------------------ */
/*                     Generic JSON / number helpers                  */
/* ------------------------------------------------------------------ */

export function safeParseJson<T = any>(value: any): T | null {
  try {
    if (!value) return null;
    return JSON.parse(String(value)) as T;
  } catch {
    return null;
  }
}

export function toInt(x: any): number {
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function toMinor(val: any): number {
  if (val == null || val === "") return 0;
  const s = String(val);
  const num = Number(val);
  if (Number.isNaN(num)) return 0;
  return s.includes(".") ? Math.round(num * 100) : Math.round(num);
}

/* ------------------------------------------------------------------ */
/*                    Normalising payment / order items               */
/* ------------------------------------------------------------------ */

export function normalisePaymentItem(raw: any): LastPaymentItem {
  const qty = Math.max(1, Number(raw?.qty) || Number(raw?.quantity) || 1);

  let variation: string | null =
    (raw?.variations ??
      raw?.variation ??
      raw?.optionLabel ??
      raw?.selectedLabel ??
      raw?.label ??
      raw?.strength ??
      raw?.dose ??
      null) ||
    null;

  let name =
    (raw?.product?.name || raw?.baseName || raw?.name || raw?.title || "Item") +
    "";
  name = name.trim();

  const sku = (raw?.sku || raw?.slug || raw?.id || "item") + "";

  if (!variation) {
    const m = /^(.+?)\s+(\d[\s\S]*)$/.exec(name);
    if (m && m[1] && m[2]) {
      name = m[1].trim();
      variation = m[2].trim() || null;
    }
  }

  const unitMinor = toMinor(
    raw?.unitMinor ??
      raw?.priceMinor ??
      raw?.amountMinor ??
      raw?.unit_price ??
      raw?.price ??
      0
  );
  const totalMinor =
    typeof raw?.totalMinor === "number" ? raw.totalMinor : unitMinor * qty;

  return {
    sku,
    name,
    variations: variation,
    qty,
    unitMinor,
    totalMinor,
  };
}

/**
 * Merge items from last_payment + cart, deduping "combined" lines.
 */
export function mergePaymentItemsFromSources(
  fromLast: any,
  fromCart: any[]
): LastPaymentItem[] {
  const cart: any[] = Array.isArray(fromCart) ? fromCart : [];
  const lastRaw: any[] = Array.isArray(fromLast) ? fromLast : [];

  const last = cart.length
    ? lastRaw.filter((r) => {
        const sku = String(r?.sku || "");
        const variations = String(r?.variations ?? r?.variation ?? "");
        const looksCombined = sku === "item" || variations.includes(" • ");
        return !looksCombined;
      })
    : lastRaw;

  const merged = [...cart, ...last];
  const seen = new Set<string>();
  const out: LastPaymentItem[] = [];

  for (const raw of merged) {
    const i = normalisePaymentItem(raw);
    const key = `${i.sku}::${i.variations || ""}::${i.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(i);
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/*                     last_payment payload helpers                   */
/* ------------------------------------------------------------------ */

export function buildLastPaymentPayload(
  ref: string,
  totals: CartTotals,
  slug: string,
  appointmentAtIso: string | null
): LastPaymentPayload {
  const mapped: LastPaymentItem[] = (totals.lines || []).map((it) => ({
    sku: String(it.sku || "item"),
    name: String(it.name || "Item"),
    variations: (it.label || null) as string | null,
    qty: Math.max(1, Number(it.qty) || 1),
    unitMinor: Number(it.unitMinor || 0) || 0,
    totalMinor: Number(it.totalMinor || 0) || 0,
  }));

  let sessionId: string | undefined = undefined;
  try {
    const s1 =
      typeof window !== "undefined"
        ? window.localStorage.getItem("consultation_session_id") || ""
        : "";
    const s2 =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("consultation_session_id") || ""
        : "";
    sessionId = (s1 || s2 || "").trim() || undefined;
  } catch {
    // ignore
  }

  return {
    ref,
    amountMinor: totals.totalMinor,
    ts: Date.now(),
    slug: slug || "",
    appointment_at: appointmentAtIso || null,
    sessionId,
    items: mapped,
  };
}

export function persistLastPayment(payload: LastPaymentPayload) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("last_payment", JSON.stringify(payload));
    window.localStorage.setItem("orders_dirty", "1");
    window.localStorage.setItem("clear_cart", "1");
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/*                       Ryft session + SDK helpers                   */
/* ------------------------------------------------------------------ */

/**
 * Call your Next.js API route that creates a Ryft payment session.
 * Must be implemented in /app/api/pay/ryft/session/route.ts
 */
export async function createRyftSessionApi(params: {
  amountMinor: number;
  currency: string;
  reference: string;
  description?: string;
}): Promise<string> {
  const res = await fetch("/api/pay/ryft/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: params.amountMinor,
      currency: params.currency,
      description: params.description ?? "Clinic payment",
      reference: params.reference,
    }),
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  const friendly = (s: string) => {
    if (!s) return "";
    const trimmed = s.trim();
    if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
      return "Could not create payment session (404). Is /api/pay/ryft/session implemented and reachable?";
    }
    return trimmed.slice(0, 400);
  };

  if (!res.ok) {
    const msg = friendly(
      data?.detail ||
        data?.message ||
        text ||
        "Could not create payment session"
    );
    throw new Error(msg);
  }

  const secret = data?.clientSecret;
  if (!secret) {
    throw new Error("Server did not return clientSecret");
  }

  return secret;
}

/**
 * Wait until the Ryft SDK script has attached window.Ryft
 */
export function ensureRyftSdkLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("No window"));
      return;
    }

    if ((window as any).Ryft) {
      resolve();
      return;
    }

    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if ((window as any).Ryft) {
        clearInterval(timer);
        resolve();
      } else if (tries > 50) {
        clearInterval(timer);
        reject(new Error("Ryft SDK not loaded"));
      }
    }, 100);
  });
}

/* ------------------------------------------------------------------ */
/*             Pending order creation & status helpers                */
/* ------------------------------------------------------------------ */

const SUCCESS_DONE_PREFIX = "success_done_";

export function wasSuccessProcessed(ref: string): boolean {
  if (!ref) return false;
  try {
    if (typeof window === "undefined") return false;
    return !!window.localStorage.getItem(SUCCESS_DONE_PREFIX + ref);
  } catch {
    return false;
  }
}

export function markSuccessProcessed(ref: string) {
  if (!ref) return;
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SUCCESS_DONE_PREFIX + ref, "1");
  } catch {
    // ignore
  }
}

export function buildLocalOrderPreview(params: {
  ref: string;
  amountMinor: number;
  items: LastPaymentItem[];
}) {
  const { ref, amountMinor, items } = params;
  return {
    id: ref || `temp-${Date.now()}`,
    reference: ref || undefined,
    createdAt: new Date().toISOString(),
    status: "Pending",
    totalMinor: amountMinor,
    items: items.map((i) => ({
      sku: i.sku || "item",
      name: i.name,
      variations: i.variations ?? null,
      variation: i.variations ?? null,
      strength: i.variations ?? null,
      qty: i.qty,
      unitMinor: i.unitMinor,
      totalMinor: i.totalMinor ?? i.unitMinor * Math.max(1, i.qty || 1),
    })),
  };
}

export function storeLocalOrderPreview(order: any) {
  try {
    if (typeof window === "undefined") return;
    const key = "local_orders";
    const prev: any[] = safeParseJson(window.localStorage.getItem(key)) || [];
    const refKey = String(order.reference || order.id || "");
    const dedup = (Array.isArray(prev) ? prev : []).filter(
      (p) => String(p?.reference || p?.id || "") !== refKey
    );
    const next = [order, ...dedup].slice(0, 5);
    window.localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("orders:updated"));
  } catch {
    // ignore
  }
}

const pendingOrderInFlight = new Set<string>();

/**
 * Idempotent wrapper around POST /api/orders/pending.
 * Ensures we only POST once per `ref`, even if React effects
 * run multiple times.
 */
export async function postPendingOrderOnce(
  ref: string,
  body: any
): Promise<void> {
  if (!ref) return;

  // in-memory guard (same page load / StrictMode)
  if (pendingOrderInFlight.has(ref)) return;

  // persisted guard (across reloads)
  if (wasSuccessProcessed(ref)) return;

  pendingOrderInFlight.add(ref);
  try {
    await fetch("/api/orders/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    // mark as processed so we never re-post for this ref
    markSuccessProcessed(ref);
  } catch {
    // on error we DON'T mark as processed so user can retry
  } finally {
    pendingOrderInFlight.delete(ref);
  }
}

/**
 * Backend call: GET /account/orders/by-ref/:ref
 */
export async function fetchOrderByReferenceApi(ref: string): Promise<any> {
  const base = getBackendBase(); // includes /api
  const url = `${base}/orders?reference=${encodeURIComponent(ref)}`;

  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("session_token") || ""
      : "";

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {}

  if (!res.ok) {
    const msg =
      json?.message ||
      json?.error ||
      `Failed to fetch order by reference: ${ref} (HTTP ${res.status})`;
    throw new Error(msg);
  }

  // Handle common response shapes safely
  if (Array.isArray(json)) return json[0] ?? null;
  if (Array.isArray(json?.data)) return json.data[0] ?? null;
  return json; // if backend returns a single object
}

/**
 * PATCH /orders/:id
 * Convenience helper to mark an order as paid (or update payment_status).
 * Adjust the URL/method/body if your backend uses a different route.
 */
export async function markOrderPaidApi(
  orderId: string,
  payload?: { payment_status?: string; [key: string]: any }
): Promise<OrderDto> {
  const base = getBackendBase();

  const body = {
    payment_status: "paid",
    ...(payload || {}),
  };

  return jsonFetch<OrderDto>(`${base}/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/* ------------------------------------------------------------------ */
/*                             APPOINTMENTS                           */
/* ------------------------------------------------------------------ */

export type CreateAppointmentPayload = {
  order_id: string;
  user_id: string;
  service_id: string;
  schedule_id: string;
  start_at: string; // ISO string: "2025-11-26T14:30:00.000Z"
  end_at: string; // ISO string
  join_url?: string; // optional – can be provided or generated server-side
  host_url?: string; // optional
};

export type UpdateAppointmentPayload = Partial<{
  order_id: string;
  user_id: string;
  service_id: string;
  schedule_id: string;
  start_at: string;
  end_at: string;
  join_url: string;
  host_url: string;
  status: string;
  [key: string]: any;
}>;
export type AppointmentDto = {
  _id: string;
  order_id: string;
  user_id: string;
  service_id: string;
  schedule_id: string;
  start_at: string;
  end_at: string;
  join_url?: string;
  host_url?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

/* ---------- NEW: booked slots types + API ---------- */

export type BookedSlotInfo = {
  time: string; // "09:00"
  count: number; // how many appointments booked for that time
  is_full: boolean;
};

export type BookedSlotsResponse = {
  schedule_id: string;
  date: string; // "YYYY-MM-DD"
  capacity: number; // per-slot capacity from backend
  slots: BookedSlotInfo[];
};

/**
 * GET /appointments/booked-slots?schedule_id=...&date=YYYY-MM-DD
 */
export async function fetchBookedSlotsApi(
  scheduleId: string,
  date: string
): Promise<BookedSlotsResponse> {
  const base = getBackendBase(); // e.g. http://localhost:8000/api

  const params = new URLSearchParams({
    schedule_id: scheduleId,
    date,
  });

  return jsonFetch<BookedSlotsResponse>(
    `${base}/appointments/booked-slots?${params.toString()}`,
    {
      method: "GET",
    }
  );
}

/**
 * POST /appointments
 */
export async function createAppointmentApi(
  payload: CreateAppointmentPayload
): Promise<AppointmentDto> {
  const base = getBackendBase();
  return jsonFetch<AppointmentDto>(`${base}/appointments`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * ✅ PUT /appointments/:id
 * Use this to update join_url / host_url after Zoom meeting is created.
 */
export async function updateAppointmentApi(
  appointmentId: string,
  payload: UpdateAppointmentPayload
): Promise<AppointmentDto> {
  const base = getBackendBase();
  return jsonFetch<AppointmentDto>(
    `${base}/appointments/${encodeURIComponent(appointmentId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    }
  );
}

/* ------------------------------------------------------------------ */
/*                     Dynamic storefront home page                    */
/* ------------------------------------------------------------------ */
export type DynamicNavbarContent = {
  logoUrl?: string;
  logoAlt?: string;
  icon?: string;
  searchPlaceholder?: string;
  navLinks?: {
    label: string;
    href: string;
    external?: boolean;
  }[];
};

export type DynamicFooterContent = {
  brandName?: string;
  brandDescription?: string;
  infoLinks?: { label: string; href: string }[];
  contact?: {
    phoneLabel?: string;
    emailLabel?: string;
    addressLabel?: string;
  };
  bottomLeft?: string;
  bottomRight?: string;
};

export type DynamicHomePageContent = {
  slug: string;

  // These match the sections we defined in NestJS
  navbar?: Record<string, any>;
  hero?: Record<string, any>;
  safeSecure?: Record<string, any>;
  keyBenefits?: Record<string, any>;
  faq?: Record<string, any>;
  contact?: Record<string, any>;
  testimonials?: Record<string, any>;
  footer?: Record<string, any>;

  // allow extra custom sections in future
  [key: string]: any;
};

/**
 * GET /dynamicHomePages/:slug
 * Public endpoint for the storefront (dynamic UI content).
 *
 * Example:
 *   const home = await fetchDynamicHomePage();       // slug "home"
 *   const wm   = await fetchDynamicHomePage("wm");   // slug "wm"
 */
export async function fetchDynamicHomePage(
  slug: string = "home"
): Promise<DynamicHomePageContent> {
  const baseUrl = getBackendBase(); // Retrieves the appropriate backend URL
  console.log("fetch Backend base URL:", baseUrl); // Debugging: Log the backend base URL

  try {
    // Fetch dynamic content from the backend
    const response = await fetch(
      `${baseUrl}/dynamicHomePages/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        cache: "no-store", // Prevents caching, ensures always fresh data
      }
    );

    if (!response.ok) {
      // Log response status and the URL that failed
      console.error(`Error: ${response.status} - ${response.statusText}`);
      throw new Error(`Failed to fetch dynamic home page content: ${response.statusText}`);
    }

    // Parse and return the JSON response
    return response.json();
  } catch (error) {
    // Log the error for debugging
    console.error("Error fetching dynamic content:", error);

    // Optionally, you could provide a fallback or additional handling here
    throw error; // Rethrow for handling in page.tsx
  }
}


/* ------------------------------------------------------------------ */
/*                             Email send API                         */
/* ------------------------------------------------------------------ */

export type SendEmailPayload = {
  to: string;
  subject: string;
  template: string; // e.g. "welcome"
  context?: Record<string, any>;
  attachments?: File[]; // optional multiple files
};

export type SendEmailResult = {
  success?: boolean;
  message?: string;
  [key: string]: any;
};

export async function sendEmailApi(
  payload: SendEmailPayload
): Promise<SendEmailResult> {
  const base = getBackendBase();
  const tokenHeader = getAuthHeader();

  const fd = new FormData();

  fd.append("to", payload.to);
  fd.append("subject", payload.subject);
  fd.append("template", payload.template);

  if (payload.context) {
    // backend expects text – send JSON string like in Postman
    fd.append("context", JSON.stringify(payload.context));
  }

  if (payload.attachments && payload.attachments.length) {
    // same field name for each file: "attachments"
    for (const file of payload.attachments) {
      fd.append("attachments", file);
    }
  }

  const res = await fetch(`${base}/email/send`, {
    method: "POST",
    headers: {
      // ❗ DO NOT set Content-Type; browser will set multipart boundary
      ...tokenHeader,
    },
    body: fd,
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data?.message || `Email send failed (${res.status})`);
  }

  return data as SendEmailResult;
}

/* ------------------------------------------------------------------ */
/*                          NHS register API                          */
/* ------------------------------------------------------------------ */

export type NhsRegisterPayload = {
  first_name: string;
  last_name: string;
  dob: string; // "YYYY-MM-DD"
  gender: string;
  nhs_number?: string;

  email: string;
  phone: string;

  address: string;
  address1?: string;
  address2?: string;
  city: string;
  postcode: string;
  country: string;

  use_alt_delivery?: boolean;
  delivery_address?: string;
  delivery_address1?: string;
  delivery_address2?: string;
  delivery_city?: string;
  delivery_postcode?: string;
  delivery_country?: string;

  exemption: string; // e.g. "age_60_plus"
  exemption_number?: string;
  exemption_expiry?: string; // "YYYY-MM-DD"

  consent_patient: boolean;
  consent_nomination: boolean;
  consent_nomination_explained: boolean;
  consent_exemption_signed: boolean;
  consent_scr_access: boolean;

  meta?: Record<string, any>;
};

export type NhsRegisterResult = {
  ok?: boolean;
  message?: string;
  [key: string]: any;
};

/**
 * POST /nhsService
 * Body shape:
 * {
 *   first_name, last_name, dob, gender, nhs_number,
 *   email, phone,
 *   address, address1, address2, city, postcode, country,
 *   use_alt_delivery, delivery_address, ...,
 *   exemption, exemption_number, exemption_expiry,
 *   consent_patient, consent_nomination, consent_nomination_explained,
 *   consent_exemption_signed, consent_scr_access,
 *   meta
 * }
 */
export async function nhsRegisterApi(
  payload: NhsRegisterPayload
): Promise<NhsRegisterResult> {
  const base = getBackendBase();

  const bodyToSend: NhsRegisterPayload = {
    ...payload,
    meta: {
      source: payload.meta?.source ?? "navbar_nhs_modal",
      ...payload.meta,
    },
  };

  return jsonFetch<NhsRegisterResult>(`${base}/nhsService`, {
    method: "POST",
    body: JSON.stringify(bodyToSend),
  });
}

/* ------------------------------------------------------------------ */
/*                       Page image upload API                        */
/* ------------------------------------------------------------------ */

export type UploadPageImageResult = {
  url: string; // e.g. "/upload/pages/page-1765360105968-434476082.jpg"
  filename: string; // e.g. "pexels-anntarazevich-5629205.jpg"
  [key: string]: any;
};

/**
 * POST /pages/upload-image
 * Sends a single image file via FormData and returns { url, filename }.
 *
 * `fieldName` defaults to "image" – change to "file" if your backend
 * expects a different field name.
 */
export async function uploadPageImageApi(
  file: File,
  fieldName: string = "image"
): Promise<UploadPageImageResult> {
  const base = getBackendBase();
  const tokenHeader = getAuthHeader();

  const fd = new FormData();
  fd.append(fieldName, file);

  const res = await fetch(`${base}/pages/upload-image`, {
    method: "POST",
    headers: {
      // DO NOT set Content-Type; browser will set multipart boundary
      ...tokenHeader,
    },
    body: fd,
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(
      data?.message || `Page image upload failed (${res.status})`
    );
  }

  return {
    url: data.url,
    filename: data.filename,
    ...data,
  };
}

/* ------------------------------------------------------------------ */
/*                               ZOOM                                 */
/* ------------------------------------------------------------------ */

export type CreateZoomMeetingPayload = {
  topic: string;
  start_time: string; // ISO, e.g. "2025-12-22T10:30:00Z"
  duration: number; // minutes
  timezone: string; // e.g. "Europe/London"
  agenda?: string;
};

export type ZoomMeetingDto = {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  timezone: string;
  join_url: string;
  start_url: string;
  password?: string;
  [key: string]: any;
};

/**
 * POST /zoom/meetings
 * Creates a Zoom meeting via backend.
 */
export async function createZoomMeetingApi(
  payload: CreateZoomMeetingPayload
): Promise<ZoomMeetingDto> {
  const base = getBackendBase(); // includes /api
  return jsonFetch<ZoomMeetingDto>(`${base}/zoom/meetings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
