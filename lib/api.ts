// lib/api.ts
import type { Service } from "./types";

/* ------------------- Env + helpers (same pattern as src/api.ts) ------------------- */

const ENV_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ""; // e.g. http://localhost:8000/api
const ENV_BASE_ONLY_URL = process.env.NEXT_PUBLIC_ONLY_URL || ""; // e.g. localhost:8000/api

// Helper function to check if the host is an IP
const isIp = (host: string) => /^\d+\.\d+\.\d+\.\d+$/.test(host);

// Helper function to strip protocol (e.g., http:// or https://)
const stripProtocol = (url: string) => url.replace(/^https?:\/\//, "");

/**
 * Returns the backend base URL for the *current tenant*.
 * Mirrors the behaviour of src/api.ts in your main project.
 */
export function getBackendBase(): string {
  if (typeof window === "undefined") {
    // SSR safety fallback
    return ENV_BASE_URL || "http://localhost:8000/api";
  }

  const { protocol, hostname } = window.location;

  // If we're on localhost or an IP, treat as "no subdomain"
  if (hostname === "localhost" || isIp(hostname)) {
    return resolveBaseForNoSubdomain(protocol);
  }

  // Split hostname to check for subdomain
  const parts = hostname.split(".");

  // For this project you want length >= 2 to count as "has subdomain"
  const hasSubdomain = parts.length >= 2;

  if (!hasSubdomain) {
    // No tenant subdomain -> use base URL directly
    return resolveBaseForNoSubdomain(protocol);
  }

  // Subdomain case: tenant.domain.tld -> "tenant"
  const subdomain = parts[0].toLowerCase();

  // Get the base URL from the environment variable (NEXT_PUBLIC_ONLY_URL) or fallback
  const baseOnly = stripProtocol(ENV_BASE_ONLY_URL || "localhost:8000/api"); // safe fallback

  // Example: http://tenant.backend.pharma-health.co.uk/api
  return `${protocol}//${subdomain}.${baseOnly}`;
}

/**
 * Handle base URL when there is *no* tenant subdomain.
 * This is essentially the same as in src/api.ts.
 */
function resolveBaseForNoSubdomain(protocol: string): string {
  if (ENV_BASE_URL) {
    // Already a full URL like http://localhost:8000/api
    return ENV_BASE_URL;
  }

  if (ENV_BASE_ONLY_URL) {
    // If someone misconfigured and only gave ONLY_URL, still try to use it
    return `${protocol}//${stripProtocol(ENV_BASE_ONLY_URL)}`;
  }

  // Default fallback (shouldn't be hit in production)
  return `${protocol}//localhost:8000/api`;
}

/**
 * Base URL for "master" backend (no tenant subdomain).
 * Same idea as getMasterBase() in src/api.ts.
 */
export function getMasterBase(): string {
  return ENV_BASE_URL || "http://localhost:8000/api";
}

/* ------------------- Generic helper ------------------- */

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const token = window.localStorage?.getItem("session_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

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

/* ------------------- Patient Register API ------------------- */

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
};

/**
 * POST /auth/register
 * Always sends `is_patient: true` in the body.
 */
export async function registerPatientApi(payload: RegisterPatientPayload) {
  const base = getBackendBase();

  const body = {
    ...payload,
    email_verified: payload.email_verified ?? false,
    is_patient: true,
  };

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
  user: any; // you can replace `any` with your actual user type later
};

/**
 * POST /auth/login
 * Uses JSON body, adds Bearer token header only if one already exists
 * (via jsonFetch → getAuthHeader).
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

// lib/api.ts

/* ... keep all your existing helpers: ENV_BASE_URL, getBackendBase, jsonFetch, etc ... */

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
function buildServiceImageUrl(imagePath?: string): string | null {
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
 * Fetch services for the landing page.
 * Uses your real backend shape:
 * {
 *   data: [ { _id, name, slug, description, cta_text, image, ... }, ... ],
 *   meta: { ... }
 * }
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


// lib/api.ts

export type LoggedInUser = {
  _id: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  dob?: string; // ISO string
  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postalcode?: string;
  country?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

// backend might return just the user object, or { user: LoggedInUser }
// we support both to be safe
type MeResponse = LoggedInUser | { user: LoggedInUser };

export async function getLoggedInUserApi(): Promise<LoggedInUser> {
  const base = getBackendBase(); // e.g. http://192.168.13.75:8000/api

  const data = await jsonFetch<MeResponse>(`${base}/users/me`, {
    method: "GET",
    // jsonFetch already adds:
    // - Content-Type: application/json
    // - Authorization: Bearer <token> (from localStorage)
  });
  console.log("Fetched user data:", data);

  if ("user" in data) {
    return data.user;
  }
  return data; // direct object case (your example)
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
};

export async function updatePatientApi(
  userId: string,
  payload: UpdatePatientPayload
): Promise<LoggedInUser> {
  const base = getBackendBase(); // e.g. http://localhost:8000/api or tenant base

  return jsonFetch<LoggedInUser>(`${base}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
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
  const base = getBackendBase(); // e.g. http://localhost:8000/api

  return jsonFetch<any>(`${base}/users/changePassword/${userId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


/* ------------------- Orders types ------------------- */

// 🔹 Types
export type OrderLine = {
  index: number;
  name: string;
  qty: number;
  variation?: string | null;
};

export type OrderMeta = {
  lines?: OrderLine[];
  totalMinor?: number;
  service_slug?: string;
  service?: string;
  appointment_start_at?: string;
  payment_status?: string;
  // ...anything else you care about
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

export type OrdersListResponse = {
  data: OrderDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// 🔹 Helper to call backend with Bearer token (you already have something like this)
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl =getBackendBase();

  // however you get token – from cookies, localStorage, AuthContext, etc.
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("pharmacy_token")
      : null;

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// 🔹 The orders API helper
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

  // e.g. GET http://localhost:8000/api/orders?user_id=...&page=1&limit=20
  return apiFetch<OrdersListResponse>(`/orders?${params.toString()}`, {
    method: "GET",
  });
}

