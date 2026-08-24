import { describe, expect, it } from "vitest";
import { generateRecurrenceDates } from "@/features/finance/domain/recurrence";

describe("generateRecurrenceDates", () => {
  it("clamps monthly day 31 to the last day of short months", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "monthly", validFrom: "2027-01-01", validTo: null, dayOfMonth: 31, monthOfYear: null, quarterStartMonth: null },
      "2027-01-01",
      "2027-04-30"
    );

    expect(dates).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  });

  it("clamps day 29 to Feb 29 in a leap year", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "monthly", validFrom: "2028-01-01", validTo: null, dayOfMonth: 29, monthOfYear: null, quarterStartMonth: null },
      "2028-02-01",
      "2028-02-29"
    );

    expect(dates).toEqual(["2028-02-29"]);
  });

  it("generates quarterly occurrences from the configured start month", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "quarterly", validFrom: "2027-01-01", validTo: null, dayOfMonth: 15, monthOfYear: null, quarterStartMonth: 2 },
      "2027-01-01",
      "2027-12-31"
    );

    expect(dates).toEqual(["2027-02-15", "2027-05-15", "2027-08-15", "2027-11-15"]);
  });

  it("generates a single annual occurrence per year", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "annual", validFrom: "2025-01-01", validTo: null, dayOfMonth: 1, monthOfYear: 8, quarterStartMonth: null },
      "2027-01-01",
      "2029-12-31"
    );

    expect(dates).toEqual(["2027-08-01", "2028-08-01", "2029-08-01"]);
  });

  it("returns only specific dates within range", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "specific_dates", validFrom: "2027-01-01", validTo: null, dayOfMonth: null, monthOfYear: null, quarterStartMonth: null },
      "2027-01-01",
      "2027-12-31",
      [{ occurrenceDate: "2027-03-10" }, { occurrenceDate: "2028-01-01" }]
    );

    expect(dates).toEqual(["2027-03-10"]);
  });

  it("respects validTo as an upper bound", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "monthly", validFrom: "2027-01-01", validTo: "2027-03-15", dayOfMonth: 20, monthOfYear: null, quarterStartMonth: null },
      "2027-01-01",
      "2027-12-31"
    );

    expect(dates).toEqual(["2027-01-20", "2027-02-20"]);
  });

  it("returns the single occurrence for a one-off cash flow", () => {
    const dates = generateRecurrenceDates(
      { recurrenceType: "once", validFrom: "2027-06-15", validTo: null, dayOfMonth: null, monthOfYear: null, quarterStartMonth: null },
      "2027-01-01",
      "2027-12-31"
    );

    expect(dates).toEqual(["2027-06-15"]);
  });
});
