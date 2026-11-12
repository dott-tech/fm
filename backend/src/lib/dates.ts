import { z } from "zod";

// Entry dates travel as plain "YYYY-MM-DD" strings (the driver's local day).
// The database column is DATE (no time), and Prisma represents it as a JS Date
// at UTC midnight. These two helpers convert in both directions so no
// time-zone shift can ever move an entry to another day.

export const isoDate = z.iso.date({ message: "Date must be YYYY-MM-DD" });

export function toDbDate(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDay: string, days: number): string {
  const d = toDbDate(isoDay);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

// Work weeks run Saturday -> Friday (the common week in Iraq, Friday off).
// Returns the Saturday and Friday of the week that contains `isoDay`.
export function weekContaining(isoDay: string): { start: string; end: string } {
  const dayOfWeek = toDbDate(isoDay).getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const daysSinceSaturday = (dayOfWeek + 1) % 7; // Saturday -> 0, Friday -> 6
  const start = addDays(isoDay, -daysSinceSaturday);
  return { start, end: addDays(start, 6) };
}
