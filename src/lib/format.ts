// Dates are formatted in UTC: a played-on date is a calendar date, and
// formatting it in a local zone west of UTC would show the previous day.
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const fullFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "Sat 12 Sep" for a YYYY-MM-DD date. */
export function formatPlayedOn(date: string) {
  return dayFormat.format(new Date(`${date}T00:00:00Z`));
}

/** "12 Sep 2026" for a timestamp or date. */
export function formatDate(value: string) {
  return fullFormat.format(
    new Date(value.length === 10 ? `${value}T00:00:00Z` : value),
  );
}

/** Today's date as YYYY-MM-DD in the viewer's zone, for date inputs. */
export function todayIso(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatRating(rating: number) {
  return Math.round(rating).toString();
}

export function formatDelta(delta: number) {
  const rounded = Math.round(delta);
  if (rounded === 0) return "±0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}
