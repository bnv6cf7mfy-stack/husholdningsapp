"use client";

import { useMemo, useState } from "react";
import type { FinanceForecastChartData } from "@/features/finance/queries";

const currencyFormatter = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
const compactCurrencyFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  notation: "compact",
  maximumFractionDigits: 1
});
const monthNameFormatter = new Intl.DateTimeFormat("nb-NO", { month: "short" });

/** "2027-03" -> "mars" */
function formatMonthLabel(yearMonth: string): string {
  return monthNameFormatter.format(new Date(`${yearMonth}-01T00:00:00Z`));
}

const ALL_HOUSEHOLD_KEY = "all";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PADDING_LEFT = 64;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 36;

type Point = { label: string; value: number; isCritical?: boolean };

/** Maps a list of (label, value) points onto an SVG line chart with labeled axes, gridlines and a hover tooltip. */
function LiquidityLineChart({
  points,
  xAxisLabel,
  emptyMessage
}: {
  points: Point[];
  xAxisLabel: string;
  emptyMessage: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const innerWidth = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

  const toX = (index: number) => PADDING_LEFT + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const toY = (value: number) => PADDING_TOP + innerHeight - ((value - min) / range) * innerHeight;
  const zeroY = toY(0);

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${toX(index)} ${toY(point.value)}`).join(" ");
  const hasNegative = min < 0;

  const gridValues = Array.from(new Set([max, (max + min) / 2, min]));
  const xLabelIndexes = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1].filter((i) => i >= 0))
  );

  const hovered = hoverIndex != null ? points[hoverIndex] : null;
  const tooltipX = hoverIndex != null ? Math.min(Math.max(toX(hoverIndex), PADDING_LEFT + 60), CHART_WIDTH - PADDING_RIGHT - 60) : 0;

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Likviditetsgraf">
      {/* Y-axis gridlines + value labels */}
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={PADDING_LEFT}
            y1={toY(value)}
            x2={CHART_WIDTH - PADDING_RIGHT}
            y2={toY(value)}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          <text x={PADDING_LEFT - 8} y={toY(value)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#64748b">
            {compactCurrencyFormatter.format(value)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabelIndexes.map((index) => (
        <text
          key={index}
          x={toX(index)}
          y={CHART_HEIGHT - PADDING_BOTTOM + 16}
          textAnchor="middle"
          fontSize={10}
          fill="#64748b"
        >
          {points[index].label}
        </text>
      ))}
      <text
        x={CHART_WIDTH / 2}
        y={CHART_HEIGHT - 4}
        textAnchor="middle"
        fontSize={10}
        fill="#94a3b8"
        className="uppercase tracking-wide"
      >
        {xAxisLabel}
      </text>

      {hasNegative ? (
        <rect
          x={PADDING_LEFT}
          y={zeroY}
          width={innerWidth}
          height={Math.max(0, PADDING_TOP + innerHeight - zeroY)}
          fill="#fee2e2"
        />
      ) : null}
      <line
        x1={PADDING_LEFT}
        y1={zeroY}
        x2={CHART_WIDTH - PADDING_RIGHT}
        y2={zeroY}
        stroke="#94a3b8"
        strokeDasharray="4 4"
        strokeWidth={1}
      />
      <path d={linePath} fill="none" stroke="#0f172a" strokeWidth={2} />

      {hoverIndex != null ? (
        <line x1={toX(hoverIndex)} y1={PADDING_TOP} x2={toX(hoverIndex)} y2={PADDING_TOP + innerHeight} stroke="#cbd5e1" strokeWidth={1} />
      ) : null}

      {points.map((point, index) => (
        <g key={point.label}>
          <circle
            cx={toX(index)}
            cy={toY(point.value)}
            r={3}
            fill={point.value < 0 || point.isCritical ? "#dc2626" : "#0f172a"}
          />
          <circle
            cx={toX(index)}
            cy={toY(point.value)}
            r={8}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
          >
            <title>
              {point.label}: {currencyFormatter.format(point.value)}
            </title>
          </circle>
        </g>
      ))}

      {hovered ? (
        <g transform={`translate(${tooltipX}, ${PADDING_TOP + 4})`}>
          <rect x={-58} y={0} width={116} height={34} rx={6} fill="#0f172a" opacity={0.92} />
          <text x={0} y={14} textAnchor="middle" fontSize={10} fill="#e2e8f0">
            {hovered.label}
          </text>
          <text x={0} y={27} textAnchor="middle" fontSize={11} fontWeight={600} fill="#ffffff">
            {currencyFormatter.format(hovered.value)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function ForecastChart({ chart }: { chart: FinanceForecastChartData }) {
  const [view, setView] = useState<"month" | "year" | "multiYear">("year");
  const [ownerKey, setOwnerKey] = useState<string>(ALL_HOUSEHOLD_KEY);

  const ownerOptions = [{ key: ALL_HOUSEHOLD_KEY, label: "Alle (husholdningen samlet)" }, ...chart.perMember.map((m) => ({ key: m.ownerKey, label: m.ownerLabel }))];

  const activeSeries = ownerKey === ALL_HOUSEHOLD_KEY ? chart : chart.perMember.find((m) => m.ownerKey === ownerKey);

  const points = useMemo<Point[]>(() => {
    if (!activeSeries) return [];
    if (view === "month") {
      return activeSeries.month.map((p) => ({ label: p.date.slice(8, 10), value: p.closingBalance, isCritical: p.isCritical }));
    }
    if (view === "year") {
      return activeSeries.year.map((p) => ({ label: formatMonthLabel(p.month), value: p.closingBalance, isCritical: p.isCritical }));
    }
    return activeSeries.multiYear.map((p) => ({ label: p.year, value: p.closingBalance }));
  }, [activeSeries, view]);

  const xAxisLabel = view === "month" ? "Dag i måneden" : view === "year" ? "Måned" : "År";
  const isHouseholdView = ownerKey === ALL_HOUSEHOLD_KEY;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Vis for
          <select
            value={ownerKey}
            onChange={(event) => setOwnerKey(event.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            {ownerOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <LiquidityLineChart points={points} xAxisLabel={xAxisLabel} emptyMessage="Ingen data for denne visningen ennå." />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {isHouseholdView
          ? "Y-aksen viser saldo på likvide kontoer (NOK)."
          : "Y-aksen viser akkumulert netto kontantstrøm (inntekter minus utgifter) for valgt person/kategori, ikke faktisk kontosaldo."}{" "}
        X-aksen viser {xAxisLabel.toLowerCase()}. Hold musepekeren over et punkt for å se nøyaktig verdi. Rød markering betyr negativt
        beløp{isHouseholdView ? " eller kritisk saldo" : ""}. Ren modellberegning, ikke finansrådgivning.
      </p>
    </div>
  );
}

