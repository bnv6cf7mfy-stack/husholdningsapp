import { describe, expect, it } from "vitest";
import {
  computeAnnualSurplusLiquidity,
  computeMinimumRequiredBuffer,
  computeRecommendedBuffer
} from "@/features/finance/domain/buffer-policy";

describe("buffer policy", () => {
  it("returns zero minimum buffer when balances never go negative", () => {
    expect(computeMinimumRequiredBuffer([100, 50, 0, 200])).toBe(0);
  });

  it("returns the largest liquidity gap as minimum required buffer", () => {
    expect(computeMinimumRequiredBuffer([500, -1200, -300, 800])).toBe(1200);
  });

  it("adds the safety margin on top of the minimum required buffer", () => {
    expect(computeRecommendedBuffer(1000, 0.1)).toBeCloseTo(1100, 5);
  });

  it("never reports negative surplus liquidity", () => {
    expect(computeAnnualSurplusLiquidity(500, 1000)).toBe(0);
  });

  it("reports the positive surplus above the buffer reference", () => {
    expect(computeAnnualSurplusLiquidity(5000, 1000)).toBe(4000);
  });
});
