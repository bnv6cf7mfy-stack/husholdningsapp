// Daily liquidity forecast engine. Pure TypeScript domain logic: no React or
// Supabase I/O here (see src/services/finance-forecast-service.ts for orchestration).
export type ForecastAccountInput = {
  id: string;
  paymentEnabled: boolean;
  drawPriority: number;
  minimumBalance: number | null;
  openingBalance: number;
};

export type ForecastCashFlowInput = {
  occurrenceDate: string;
  /** Positive for income, negative for expense. */
  signedAmount: number;
};

export type DailyLiquidityResult = {
  forecastDate: string;
  /** null represents the household-wide aggregate row across all accounts. */
  accountId: string | null;
  openingBalance: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  closingBalance: number;
  bufferDraw: number;
  isCritical: boolean;
};

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const cursor = new Date(Date.UTC(sy, sm - 1, sd));
  const endDate = new Date(Date.UTC(ey, em - 1, ed));

  while (cursor <= endDate) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Runs a deterministic day-by-day liquidity simulation for a household.
 *
 * Cash flows are household-level (not tied to a specific account). Each day's
 * net cash flow is applied to the payment-enabled account with the lowest
 * `drawPriority` ("primary account"). If that would breach its minimum
 * balance, the shortfall is drawn from the remaining payment-enabled accounts
 * in ascending `drawPriority` order ("buffer waterfall"), never below their
 * own minimum balance.
 */
export function runDailyForecast(params: {
  forecastStart: string;
  forecastEnd: string;
  accounts: ForecastAccountInput[];
  cashFlows: ForecastCashFlowInput[];
}): DailyLiquidityResult[] {
  const { forecastStart, forecastEnd, accounts, cashFlows } = params;

  const netByDate = new Map<string, { inflow: number; outflow: number }>();
  for (const cashFlow of cashFlows) {
    const bucket = netByDate.get(cashFlow.occurrenceDate) ?? { inflow: 0, outflow: 0 };
    if (cashFlow.signedAmount >= 0) {
      bucket.inflow += cashFlow.signedAmount;
    } else {
      bucket.outflow += Math.abs(cashFlow.signedAmount);
    }
    netByDate.set(cashFlow.occurrenceDate, bucket);
  }

  const paymentAccounts = accounts
    .filter((account) => account.paymentEnabled)
    .sort((a, b) => a.drawPriority - b.drawPriority);
  const primary = paymentAccounts[0];
  const bufferWaterfall = paymentAccounts.slice(1);

  const balances = new Map(accounts.map((account) => [account.id, account.openingBalance]));
  const results: DailyLiquidityResult[] = [];
  const dates = enumerateDates(forecastStart, forecastEnd);

  for (const date of dates) {
    const bucket = netByDate.get(date) ?? { inflow: 0, outflow: 0 };
    const net = bucket.inflow - bucket.outflow;

    const openingSnapshot = new Map(balances);
    let bufferDrawTotal = 0;

    if (primary) {
      const opening = balances.get(primary.id) ?? 0;
      let closing = opening + net;
      const threshold = primary.minimumBalance ?? 0;

      if (closing < threshold) {
        let shortfall = threshold - closing;

        for (const bufferAccount of bufferWaterfall) {
          if (shortfall <= 0) break;
          const bufferOpening = balances.get(bufferAccount.id) ?? 0;
          const bufferMinimum = bufferAccount.minimumBalance ?? 0;
          const available = Math.max(0, bufferOpening - bufferMinimum);
          const draw = Math.min(available, shortfall);

          if (draw > 0) {
            balances.set(bufferAccount.id, bufferOpening - draw);
            closing += draw;
            shortfall -= draw;
            bufferDrawTotal += draw;
          }
        }
      }

      balances.set(primary.id, closing);
    }

    let aggregateOpening = 0;
    let aggregateClosing = 0;
    let aggregateIsCritical = false;

    for (const account of accounts) {
      const opening = openingSnapshot.get(account.id) ?? 0;
      const closing = balances.get(account.id) ?? 0;
      aggregateOpening += opening;
      aggregateClosing += closing;

      const isCritical = account.minimumBalance != null ? closing < account.minimumBalance : closing < 0;
      aggregateIsCritical = aggregateIsCritical || isCritical;

      results.push({
        forecastDate: date,
        accountId: account.id,
        openingBalance: opening,
        cashInflow: account.id === primary?.id ? bucket.inflow : 0,
        cashOutflow: account.id === primary?.id ? bucket.outflow : 0,
        netCashFlow: account.id === primary?.id ? net : 0,
        closingBalance: closing,
        bufferDraw: account.id === primary?.id ? bufferDrawTotal : 0,
        isCritical
      });
    }

    results.push({
      forecastDate: date,
      accountId: null,
      openingBalance: aggregateOpening,
      cashInflow: bucket.inflow,
      cashOutflow: bucket.outflow,
      netCashFlow: net,
      closingBalance: aggregateClosing,
      bufferDraw: bufferDrawTotal,
      isCritical: aggregateIsCritical
    });
  }

  return results;
}
