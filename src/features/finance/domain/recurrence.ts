// Pure recurrence-date generation. No React/Supabase dependency so it can be
// unit tested in isolation (see tests/unit/finance/recurrence.test.ts).
import type { FinanceCashFlowDefinition, FinanceCashFlowSpecificDate } from "../types";

export type RecurrenceInput = Pick<
  FinanceCashFlowDefinition,
  "recurrenceType" | "validFrom" | "validTo" | "dayOfMonth" | "monthOfYear" | "quarterStartMonth"
>;

function toDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonth(year: number, monthIndexZeroBased: number): number {
  return new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).getUTCDate();
}

/** Clamps day-of-month to the last valid day for short months (e.g. 31 -> 28/29 in February). */
function clampedMonthDate(year: number, monthIndexZeroBased: number, requestedDay: number): Date {
  const lastDay = lastDayOfMonth(year, monthIndexZeroBased);
  const day = Math.min(requestedDay, lastDay);
  return new Date(Date.UTC(year, monthIndexZeroBased, day));
}

function clampRange(validFrom: string, validTo: string | null, rangeStart: string, rangeEnd: string) {
  const start = validFrom > rangeStart ? validFrom : rangeStart;
  const end = validTo && validTo < rangeEnd ? validTo : rangeEnd;
  return { start, end };
}

/**
 * Generates all occurrence dates for a definition within [rangeStart, rangeEnd] (inclusive),
 * intersected with the definition's own validity window.
 */
export function generateRecurrenceDates(
  definition: RecurrenceInput,
  rangeStart: string,
  rangeEnd: string,
  specificDates: Pick<FinanceCashFlowSpecificDate, "occurrenceDate">[] = []
): string[] {
  const { start, end } = clampRange(definition.validFrom, definition.validTo, rangeStart, rangeEnd);

  if (start > end) {
    return [];
  }

  const startDate = toDate(start);
  const endDate = toDate(end);
  const dates: string[] = [];

  switch (definition.recurrenceType) {
    case "once": {
      if (definition.validFrom >= start && definition.validFrom <= end) {
        dates.push(definition.validFrom);
      }
      return dates;
    }

    case "specific_dates": {
      return specificDates
        .map((entry) => entry.occurrenceDate)
        .filter((date) => date >= start && date <= end)
        .sort();
    }

    case "monthly": {
      const day = definition.dayOfMonth ?? 1;
      let year = startDate.getUTCFullYear();
      let month = startDate.getUTCMonth();

      while (true) {
        const candidate = clampedMonthDate(year, month, day);
        const iso = toIsoDate(candidate);
        if (iso > end) break;
        if (iso >= start) dates.push(iso);
        month += 1;
        if (month > 11) {
          month = 0;
          year += 1;
        }
      }
      return dates;
    }

    case "quarterly": {
      const day = definition.dayOfMonth ?? 1;
      const startMonth = ((definition.quarterStartMonth ?? 1) - 1) % 3;
      let year = startDate.getUTCFullYear();
      let month = startMonth;

      // Advance to the first quarter month at or after startDate's month.
      while (year < startDate.getUTCFullYear() || (year === startDate.getUTCFullYear() && month < startDate.getUTCMonth())) {
        month += 3;
        if (month > 11) {
          month -= 12;
          year += 1;
        }
      }

      while (true) {
        const candidate = clampedMonthDate(year, month, day);
        const iso = toIsoDate(candidate);
        if (iso > end) break;
        if (iso >= start) dates.push(iso);
        month += 3;
        if (month > 11) {
          month -= 12;
          year += 1;
        }
      }
      return dates;
    }

    case "annual": {
      const day = definition.dayOfMonth ?? 1;
      const monthIndex = (definition.monthOfYear ?? 1) - 1;
      let year = startDate.getUTCFullYear();

      while (true) {
        const candidate = clampedMonthDate(year, monthIndex, day);
        const iso = toIsoDate(candidate);
        if (iso > end) break;
        if (iso >= start) dates.push(iso);
        year += 1;
      }
      return dates;
    }

    default:
      return dates;
  }
}
