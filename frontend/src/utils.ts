// Today's date as YYYY-MM-DD in the user's local time zone
export function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().split("T")[0];
}

// "2026-10-13" -> "Oct 13, 2026"
// Parsed as a local date so the day never shifts across time zones.
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  if (!year || !month || !day) return isoDate;

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Turns network failures and unknown errors into readable messages
export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError) {
    return "Can't reach the server. Check your connection and try again.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
