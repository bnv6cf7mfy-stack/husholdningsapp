import { describe, expect, it } from "vitest";
import { applyAdjustment } from "@/features/finance/domain/adjustments";

const baseDefinition = {
  assumptionSeriesId: "series-1",
  adjustmentMonth: null,
  adjustmentDay: null,
  marginRate: null,
  floorRate: null,
  capRate: null,
  applyInBaseYear: false,
  interestCalculationMode: null,
  principalAmount: null,
  validFrom: "2027-06-01"
};

describe("applyAdjustment", () => {
  it("does not apply regulation in the registration year by default", () => {
    const amount = applyAdjustment(
      { ...baseDefinition, adjustmentType: "cpi" },
      "2027-12-31",
      10000,
      () => 0.05
    );

    expect(amount).toBe(10000);
  });

  it("applies CPI regulation on 1 January in subsequent years", () => {
    const lookup = (_seriesId: string, periodStart: string) => (periodStart === "2028-01-01" ? 0.04 : undefined);

    const beforeAnniversary = applyAdjustment({ ...baseDefinition, adjustmentType: "cpi" }, "2027-12-31", 10000, lookup);
    const afterAnniversary = applyAdjustment({ ...baseDefinition, adjustmentType: "cpi" }, "2028-01-01", 10000, lookup);

    expect(beforeAnniversary).toBe(10000);
    expect(afterAnniversary).toBeCloseTo(10400, 5);
  });

  it("applies wage growth regulation on 1 August", () => {
    const lookup = (_seriesId: string, periodStart: string) => (periodStart === "2028-01-01" ? 0.03 : undefined);

    const beforeAnniversary = applyAdjustment({ ...baseDefinition, adjustmentType: "wage_growth" }, "2028-07-31", 10000, lookup);
    const afterAnniversary = applyAdjustment({ ...baseDefinition, adjustmentType: "wage_growth" }, "2028-08-01", 10000, lookup);

    expect(beforeAnniversary).toBe(10000);
    expect(afterAnniversary).toBeCloseTo(10300, 5);
  });

  it("compounds regulation across multiple anniversary years", () => {
    const lookup = () => 0.1;

    const amount = applyAdjustment({ ...baseDefinition, adjustmentType: "cpi" }, "2030-06-01", 10000, lookup);

    // Anniversaries at 2028-01-01, 2029-01-01, 2030-01-01 => 3 compounding steps of +10%.
    expect(amount).toBeCloseTo(10000 * 1.1 * 1.1 * 1.1, 5);
  });

  it("computes interest on a principal with margin, floor and cap", () => {
    const lookup = () => 0.02;

    const amount = applyAdjustment(
      {
        ...baseDefinition,
        adjustmentType: "interest_rate",
        interestCalculationMode: "rate_on_principal",
        principalAmount: 1000000,
        marginRate: 0.01,
        floorRate: 0,
        capRate: 0.05
      },
      "2028-01-01",
      0,
      lookup
    );

    expect(amount).toBeCloseTo(1000000 * 0.03, 5);
  });

  it("caps the effective interest rate", () => {
    const lookup = () => 0.2;

    const amount = applyAdjustment(
      {
        ...baseDefinition,
        adjustmentType: "interest_rate",
        interestCalculationMode: "rate_on_principal",
        principalAmount: 100000,
        marginRate: 0,
        floorRate: 0,
        capRate: 0.05
      },
      "2028-01-01",
      0,
      lookup
    );

    expect(amount).toBeCloseTo(100000 * 0.05, 5);
  });

  it("returns the base amount unchanged when adjustmentType is none", () => {
    const amount = applyAdjustment({ ...baseDefinition, adjustmentType: "none" }, "2030-01-01", 5000, () => 0.5);
    expect(amount).toBe(5000);
  });
});
