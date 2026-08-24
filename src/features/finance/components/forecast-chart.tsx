"use client";

import { useMemo, useState } from "react";
import type { FinanceForecastChartData } from "@/features/finance/queries";

const currencyFormatter = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PADDING = 24;

type Point = { label: string; value: number; isCritical?: boolean };

/** Maps a list of (label, value) points onto an SVG line + zero-line, highlighting negative balance. */
function LiquidityLineChart({ points, emptyMessage }: { points: Point[]; emptyMessage: string }) {
  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const innerWidth = CHART_WIDTH - PADDING * 2;
  const innerHeight = CHART_HEIGHT - PADDING * 2;

  const toX = (index: number) => PADDING + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const toY = (value: number) => PADDING + innerHeight - ((value - min) / range) * innerHeight;
  const zeroY = toY(0);

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.value)}`).join(" ");
  const hasNegative = min < 0;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Likviditetsgraf">
      {hasNegative ? (
        <rect x={PADDING} y={zeroY} width={innerWidth} height={Math.max(0, PADDING + innerHeight - zeroY)} fill="#fee2e2" />
      ) : null}
      <line x1={PADDING} y1={zeroY} x2={CHART_WIDTH - PADDING} y2={zeroY} stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} />
      <path d={linePath} fill="none" stroke="#0f172a" strokeWidth={2} />
      {points.map((point, index) => (
        <circle
          key={point.label}
          cx={toX(index)}
          cy={toY(point.value)}
          r={3}
          fill={point.value < 0 || point.isCritical ? "#dc2626" : "#0f172a"}
        >
          <title>
            {point.label}: {currencyFormatter.format(point.value)}
          </title>
        </circle>
      ))}
    </svg>
  );
}

export function ForecastChart({ chart }: { chart: FinanceForecastChartData }) {
  const [view, setView] = useState<"month" | "year" | "multiYear">("year");

  const points = useMemo<Point[]>(() => {
    if (view === "month") {
      return chart.month.map((p) => ({ label: p.date, value: p.closingBalance, isCritical: p.isCritical }));
    }
    if (view === "year") {
      return chart.year.map((p) => ({ label: p.month, value: p.closingBalance, isCritical: p.isCritical }));
    }
    return chart.multiYear.map((p) => ({ label: p.year, value: p.closingBalance }));
  }, [chart, view]);

  return (
    <div>
      <div className="flex gap-2">
        {(
          [
            { key: "month", label: "Måned" },
            { key: "year", label: "År" },
            { key: "multiYear", label: "Flere år" }
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              view === tab.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <LiquidityLineChart points={points} emptyMessage="Ingen data for denne visningen ennå." />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Rød markering betyr negativ eller kritisk saldo (under valgt minimumsgrense). Ren modellberegning, ikke finansrådgivning.
      </p>
    </div>
  );
}
