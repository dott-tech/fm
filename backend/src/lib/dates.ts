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
