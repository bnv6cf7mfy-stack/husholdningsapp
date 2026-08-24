// Pure buffer-policy calculations (minimum required buffer, recommended buffer,
// annual surplus liquidity). No React/Supabase dependency.
import { DEFAULT_BUFFER_SAFETY_MARGIN } from "../types";

/** Largest liquidity gap across the forecast, i.e. how much buffer would have been needed to stay at/above zero. */
export function computeMinimumRequiredBuffer(closingBalances: number[]): number {
  const lowest = Math.min(0, ...closingBalances);
  return lowest < 0 ? -lowest : 0;
}

/** Minimum required buffer plus a configurable safety margin. This is a model estimate, not financial advice. */
export function computeRecommendedBuffer(
  minimumRequiredBuffer: number,
  safetyMargin: number = DEFAULT_BUFFER_SAFETY_MARGIN
): number {
  return minimumRequiredBuffer * (1 + safetyMargin);
}

/** Estimated liquidity available beyond the chosen buffer reference at year end. Never negative. */
export function computeAnnualSurplusLiquidity(yearEndBalance: number, bufferReference: number): number {
  const surplus = yearEndBalance - bufferReference;
  return surplus > 0 ? surplus : 0;
}
