"use client";

import type { FinanceOverview } from "@/features/finance/queries";
import { ForecastChart } from "./forecast-chart";
import { formatAmount } from "./finance-ui-helpers";

type FinanceDashboardTabProps = {
  overview: FinanceOverview;
  pending: boolean;
  onRunForecast: () => void;
};

export function FinanceDashboardTab({ overview, pending, onRunForecast }: FinanceDashboardTabProps) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Likviditetsprognose</p>
          <h2 className="mt-1 text-xl font-bold">Oversikt</h2>
        </div>
        <button
          type="button"
          onClick={onRunForecast}
          disabled={pending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Kjører …" : "Kjør prognose"}
        </button>
      </div>

      {overview.forecast ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Laveste saldo</dt>
              <dd className="font-semibold">{formatAmount(overview.forecast.lowestBalance)}</dd>
              <dd className="text-xs text-slate-400">{overview.forecast.lowestBalanceDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Minimum nødvendig buffer</dt>
              <dd className="font-semibold">{formatAmount(overview.forecast.minimumRequiredBuffer)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Anbefalt buffer</dt>
              <dd className="font-semibold">{formatAmount(overview.forecast.recommendedBuffer)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Kritiske dager</dt>
              <dd className="font-semibold">{overview.forecast.criticalDayCount}</dd>
            </div>
          </dl>
          <div className="mt-6 border-t border-slate-100 pt-6">
            <ForecastChart chart={overview.forecast.chart} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          Ingen prognose kjørt ennå. Registrer minst én konto og kontantstrøm under «Input», og trykk «Kjør prognose».
        </p>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Modellberegning, ikke finansrådgivning. Prognosehorisont: {overview.forecast?.forecastStart ?? "–"} til{" "}
        {overview.forecast?.forecastEnd ?? "–"}.
      </p>
    </section>
  );
}
