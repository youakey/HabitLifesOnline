import { format, startOfDay, subDays } from "date-fns";

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function fromISODate(s: string): Date {
  // date-fns parse ISO date without timezone issues is fine here
  return startOfDay(new Date(s + "T00:00:00"));
}

export function rangeISO(days: number, end: Date): { startISO: string; endISO: string } {
  const endDay = startOfDay(end);
  const start = subDays(endDay, days - 1);
  return { startISO: toISODate(start), endISO: toISODate(endDay) };
}
