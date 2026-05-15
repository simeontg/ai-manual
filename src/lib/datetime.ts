// Time zone helpers for events.

export function listTimeZones(): string[] {
  const intlAny = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intlAny.supportedValuesOf === "function") {
    try {
      return intlAny.supportedValuesOf("timeZone");
    } catch {
      /* fall through */
    }
  }
  return [
    "UTC",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Sofia",
    "Europe/Paris",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
  ];
}

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Format an ISO instant in a given IANA time zone with a short tz label. */
export function formatInTimeZone(
  iso: string,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  try {
    const fmt = new Intl.DateTimeFormat(undefined, {
      ...opts,
      timeZone,
      timeZoneName: "short",
    });
    return fmt.format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** Convert a `datetime-local` value (no tz) interpreted in `tz` into an ISO UTC instant. */
export function localInputToISO(localValue: string, tz: string): string {
  if (!localValue) return "";
  // localValue looks like "2026-05-07T14:30"
  // Compute the offset of `tz` at that wall time and adjust.
  const [datePart, timePart] = localValue.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  // Start with the wall-time treated as UTC, then find what UTC offset `tz` was at that moment.
  const asUTC = Date.UTC(y, m - 1, d, hh, mm, 0);
  const tzDate = new Date(asUTC);
  // Format that instant in tz to recover the offset.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = dtf.formatToParts(tzDate).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const tzAsUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
  );
  const offset = tzAsUTC - asUTC; // ms that tz is ahead of UTC for that wall time
  return new Date(asUTC - offset).toISOString();
}

/** Convert an ISO UTC instant into a `datetime-local`-shaped string (YYYY-MM-DDTHH:MM) in `tz`. */
export function isoToLocalInput(iso: string, tz: string): string {
  if (!iso) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    const hh = (Number(parts.hour) % 24).toString().padStart(2, "0");
    return `${parts.year}-${parts.month}-${parts.day}T${hh}:${parts.minute}`;
  } catch {
    return "";
  }
}
