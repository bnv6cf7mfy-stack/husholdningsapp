import { describe, expect, it } from "vitest";
import { runDailyForecast } from "@/features/finance/domain/forecast-engine";

describe("runDailyForecast", () => {
  it("carries opening/closing balances forward day by day with correct signs", () => {
    const results = runDailyForecast({
      forecastStart: "2027-01-01",
      forecastEnd: "2027-01-03",
      accounts: [{ id: "checking", paymentEnabled: true, drawPriority: 0, minimumBalance: 0, openingBalance: 1000 }],
      cashFlows: [
        { occurrenceDate: "2027-01-01", signedAmount: 500 },
        { occurrenceDate: "2027-01-02", signedAmount: -200 }
      ]
    });

    const aggregate = results.filter((row) => row.accountId === null);

    expect(aggregate.map((row) => row.closingBalance)).toEqual([1500, 1300, 1300]);
    expect(aggregate[0].cashInflow).toBe(500);
    expect(aggregate[1].cashOutflow).toBe(200);
  });

  it("draws from the buffer account when the primary account breaches its minimum balance", () => {
    const results = runDailyForecast({
      forecastStart: "2027-01-01",
      forecastEnd: "2027-01-01",
      accounts: [
        { id: "checking", paymentEnabled: true, drawPriority: 0, minimumBalance: 0, openingBalance: 100 },
        { id: "buffer", paymentEnabled: true, drawPriority: 1, minimumBalance: 0, openingBalance: 5000 }
      ],
      cashFlows: [{ occurrenceDate: "2027-01-01", signedAmount: -300 }]
    });

    const checking = results.find((row) => row.accountId === "checking")!;
    const buffer = results.find((row) => row.accountId === "buffer")!;

    expect(checking.closingBalance).toBe(0);
    expect(checking.bufferDraw).toBe(200);
    expect(buffer.closingBalance).toBe(4800);
  });

  it("flags a day as critical when an account falls below its minimum balance", () => {
    const results = runDailyForecast({
      forecastStart: "2027-01-01",
      forecastEnd: "2027-01-01",
      accounts: [{ id: "checking", paymentEnabled: true, drawPriority: 0, minimumBalance: 0, openingBalance: 100 }],
      cashFlows: [{ occurrenceDate: "2027-01-01", signedAmount: -300 }]
    });

    const checking = results.find((row) => row.accountId === "checking")!;
    expect(checking.closingBalance).toBe(-200);
    expect(checking.isCritical).toBe(true);
  });

  it("produces a deterministic result for identical input", () => {
    const params = {
      forecastStart: "2027-01-01",
      forecastEnd: "2027-06-30",
      accounts: [{ id: "checking", paymentEnabled: true, drawPriority: 0, minimumBalance: 0, openingBalance: 1000 }],
      cashFlows: [
        { occurrenceDate: "2027-02-01", signedAmount: 25000 },
        { occurrenceDate: "2027-03-15", signedAmount: -12000 }
      ]
    };

    expect(runDailyForecast(params)).toEqual(runDailyForecast(params));
  });
});
