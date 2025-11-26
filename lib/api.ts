import type { Service } from "./types";

const DEFAULT_BASE =
  typeof window === "undefined"
    ? process.env.API_BASE_URL || ""
    : process.env.NEXT_PUBLIC_API_BASE_URL || "";

const INTERNAL_SERVICES_ENDPOINT = "/api/services";

const getServicesEndpoint = () => {
  if (!DEFAULT_BASE) return INTERNAL_SERVICES_ENDPOINT;
  return `${DEFAULT_BASE.replace(/\/$/, "")}/services`;
};

export async function fetchServices(): Promise<Service[]> {
  const endpoint = getServicesEndpoint();

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch services (${res.status})`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data as Service[];
  if (Array.isArray(data?.data)) return data.data as Service[];
  return [];
}
