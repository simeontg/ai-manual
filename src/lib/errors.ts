// Map raw errors (often from Supabase/Postgres) to safe user-facing messages.
// Logs full details to the console for debugging, but never returns
// internal schema info (table names, constraint names, SQL fragments).

const GENERIC = "Something went wrong — please try again.";

interface MaybePgError {
  message?: string;
  code?: string;
  status?: number;
}

export function toUserMessage(error: unknown, fallback: string = GENERIC): string {
  // Always log the real error for the developer.
  if (typeof console !== "undefined") {
    console.error(error);
  }

  const e = (error ?? {}) as MaybePgError;
  const raw = (e.message ?? "").toString();
  const lower = raw.toLowerCase();

  // Postgres / PostgREST codes
  switch (e.code) {
    case "23505":
      return "This already exists.";
    case "23503":
      return "Related record not found.";
    case "23514":
      return "That value isn't allowed.";
    case "PGRST301":
    case "42501":
      return "You don't have permission to do that.";
  }

  // HTTP-ish hints
  if (e.status === 401 || e.status === 403) {
    return "You don't have permission to do that.";
  }
  if (e.status === 404) {
    return "Not found.";
  }
  if (e.status === 429) {
    return "Too many requests — please slow down.";
  }

  // Common Supabase Auth messages — these are already user-safe.
  const authSafe = [
    "invalid login credentials",
    "email not confirmed",
    "user already registered",
    "password should be at least",
    "email address is invalid",
    "for security purposes",
    "signups not allowed",
  ];
  if (authSafe.some((s) => lower.includes(s))) {
    return raw;
  }

  // Pattern matches on common Postgres error text
  if (lower.includes("duplicate key") || lower.includes("unique constraint")) {
    if (lower.includes("rsvp")) return "You've already RSVP'd to this event.";
    return "This already exists.";
  }
  if (lower.includes("violates row-level security") || lower.includes("permission denied")) {
    return "You don't have permission to do that.";
  }
  if (lower.includes("foreign key")) {
    return "Related record not found.";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("failed to fetch")
  ) {
    return "Network error — please check your connection.";
  }

  // If the message looks like an internal/SQL error, hide it.
  const looksInternal =
    lower.includes("constraint") ||
    lower.includes("relation ") ||
    lower.includes("column ") ||
    lower.includes("schema ") ||
    lower.includes("syntax error") ||
    lower.includes("pg_") ||
    lower.includes("supabase") ||
    /\b[a-z_]+_[a-z_]+_(key|fkey|pkey|idx)\b/.test(lower);

  if (looksInternal || !raw) return fallback;

  // Short, plain messages we wrote ourselves are fine to surface.
  if (raw.length <= 140) return raw;

  return fallback;
}
