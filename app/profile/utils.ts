import type { AuthUser } from "@/components/auth/AuthProvider";

export function formatDate(iso?: string) {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso?: string) {
  if (!iso) return "Not set";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatMoneyFromMinor(minor?: number) {
  if (minor == null) return "—";
  return `£${(minor / 100).toFixed(2)}`;
}



/** Safely extract a user id from any stored user object */
export function getUserIdFromUser(
  user: AuthUser | null | undefined
): string | null {
  if (!user) return null;

  // we know AuthUser has an index signature, so we can safely cast
  const anyUser = user as any;

  // try common id shapes (_id from Mongo, id, user_id, etc.)
  return anyUser._id ?? anyUser.id ?? anyUser.user_id ?? null;
}

/** Decode JWT and pull out the subject / user id */
export function getUserIdFromToken(
  token: string | null | undefined
): string | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payloadPart = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const json = typeof window !== "undefined"
      ? window.atob(payloadPart)
      : Buffer.from(payloadPart, "base64").toString("binary");

    const payload = JSON.parse(json);

    return (
      payload.sub ??
      payload.userId ??
      payload.user_id ??
      null
    );
  } catch {
    return null;
  }
}
