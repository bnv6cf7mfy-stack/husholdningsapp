"use client";

import { useEffect, useMemo, useState } from "react";
import { getFinanceChartSelectionAction } from "@/features/finance/actions";
import type { FinanceForecastChartData } from "@/features/finance/queries";

const currencyFormatter = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
const compactCurrencyFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  notation: "compact",
  maximumFractionDigits: 1
});
const monthNameFormatter = new Intl.DateTimeFormat("nb-NO", { month: "short" });
const monthOptionFormatter = new Intl.DateTimeFormat("nb-NO", { month: "long" });

/** "2027-03" -> "mars" */
function formatMonthLabel(yearMonth: string): string {
  return monthNameFormatter.format(new Date(`${yearMonth}-01T00:00:00Z`));
}

function monthOptionLabel(month: number): string {
  const label = monthOptionFormatter.format(new Date(Date.UTC(2000, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const ALL_HOUSEHOLD_KEY = "all";

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PADDING_LEFT = 64;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 36;

type Point = { label: string; value: number; isCritical?: boolean };
type RawPoint = { label: string; closingBalance: number; netCashFlow: number; isCritical?: boolean };

/** Renders points as a line (accumulated balance) or bars (isolated period net), with a click/hover tooltip that works on touch too. */
function LiquidityChart({
  points,
  xAxisLabel,
  renderAs,
  emptyMessage
}: {
  points: Point[];
  xAxisLabel: string;
  renderAs: "line" | "bar";
  emptyMessage: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  useEffect(() => {
    setHoverIndex(null);
    setPinnedIndex(null);
  }, [points]);

  if (points.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const activeIndex = hoverIndex ?? pinnedIndex;
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
  const barWidth = Math.min(28, (innerWidth / points.length) * 0.6);

  const gridValues = Array.from(new Set([max, (max + min) / 2, min]));
  const xLabelIndexes = Array.from(
    new Set([0, Math.floor((points.length - 1) / 2), points.length - 1].filter((i) => i >= 0))
  );

  const active = activeIndex != null ? points[activeIndex] : null;
  const tooltipX =
    activeIndex != null ? Math.min(Math.max(toX(activeIndex), PADDING_LEFT + 60), CHART_WIDTH - PADDING_RIGHT - 60) : 0;

  function togglePin(index: number) {
    setPinnedIndex((current) => (current === index ? null : index));
  }

  return (
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full touch-manipulation" role="img" aria-label="Likviditetsgraf">
      {/* Y-axis gridlines + value labels */}
      {gridValues.map((value) => (
        <g key={value}>
          <line x1={PADDING_LEFT} y1={toY(value)} x2={CHART_WIDTH - PADDING_RIGHT} y2={toY(value)} stroke="#e2e8f0" strokeWidth={1} />
          <text x={PADDING_LEFT - 8} y={toY(value)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#64748b">
            {compactCurrencyFormatter.format(value)}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabelIndexes.map((index) => (
        <text key={index} x={toX(index)} y={CHART_HEIGHT - PADDING_BOTTOM + 16} textAnchor="middle" fontSize={10} fill="#64748b">
          {points[index].label}
        </text>
      ))}
      <text x={CHART_WIDTH / 2} y={CHART_HEIGHT - 4} textAnchor="middle" fontSize={10} fill="#94a3b8" className="uppercase tracking-wide">
        {xAxisLabel}
      </text>

      {hasNegative && renderAs === "line" ? (
        <rect x={PADDING_LEFT} y={zeroY} width={innerWidth} height={Math.max(0, PADDING_TOP + innerHeight - zeroY)} fill="#fee2e2" />
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

      {renderAs === "line" ? <path d={linePath} fill="none" stroke="#0f172a" strokeWidth={2} /> : null}

      {activeIndex != null ? (
        <line
          x1={toX(activeIndex)}
          y1={PADDING_TOP}
          x2={toX(activeIndex)}
          y2={PADDING_TOP + innerHeight}
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      ) : null}

      {points.map((point, index) => {
        const isNegative = point.value < 0;
        const barY = renderAs === "bar" ? Math.min(toY(point.value), zeroY) : 0;
        const barHeight = renderAs === "bar" ? Math.abs(toY(point.value) - zeroY) : 0;

        return (
          <g key={`${point.label}-${index}`}>
            {renderAs === "bar" ? (
              <rect
                x={toX(index) - barWidth / 2}
                y={barY}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                fill={isNegative || point.isCritical ? "#dc2626" : "#16a34a"}
                rx={2}
              />
            ) : (
              <circle cx={toX(index)} cy={toY(point.value)} r={3} fill={isNegative || point.isCritical ? "#dc2626" : "#0f172a"} />
            )}
            {/* Larger transparent hit target: works for both mouse hover and touch tap. */}
            <rect
              x={toX(index) - Math.max(barWidth, 16) / 2}
              y={PADDING_TOP}
              width={Math.max(barWidth, 16)}
              height={innerHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex((current) => (current === index ? null : current))}
              onClick={(event) => {
                event.stopPropagation();
                togglePin(index);
              }}
            >
              <title>
                {point.label}: {currencyFormatter.format(point.value)}
              </title>
            </rect>
          </g>
        );
      })}

      {active ? (
        <g transform={`translate(${tooltipX}, ${PADDING_TOP + 4})`}>
          <rect x={-58} y={0} width={116} height={34} rx={6} fill="#0f172a" opacity={0.92} />
          <text x={0} y={14} textAnchor="middle" fontSize={10} fill="#e2e8f0">
            {active.label}
          </text>
          <text x={0} y={27} textAnchor="middle" fontSize={11} fontWeight={600} fill="#ffffff">
            {currencyFormatter.format(active.value)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

type ForecastChartProps = {
  chart: FinanceForecastChartData;
  forecastStart: string;
  forecastEnd: string;
};

export function ForecastChart({ chart, forecastStart, forecastEnd }: ForecastChartProps) {
  const [view, setView] = useState<"month" | "year" | "multiYear">("year");
  const [ownerKey, setOwnerKey] = useState<string>(ALL_HOUSEHOLD_KEY);
  const [valueMode, setValueMode] = useState<"accumulated" | "period">("accumulated");

  const defaultYear = Number(forecastStart.slice(0, 4));
  const defaultMonth = Number(forecastStart.slice(5, 7));
  const startYear = defaultYear;
  const endYear = Number(forecastEnd.slice(0, 4));

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);

  const [remotePoints, setRemotePoints] = useState<{ month?: RawPoint[]; year?: RawPoint[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const yearOptions = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1).filter((month) => {
    if (selectedYear === startYear && month < defaultMonth) return false;
    if (selectedYear === endYear && month > Number(forecastEnd.slice(5, 7))) return false;
    return true;
  });

  const isDefaultPeriod =
    (view === "month" && selectedYear === defaultYear && selectedMonth === defaultMonth) ||
    (view === "year" && selectedYear === defaultYear);

  // Fetch on demand only when the user picks a month/year outside the preloaded default period.
  useEffect(() => {
    if (view === "multiYear" || isDefaultPeriod) {
      setRemotePoints(null);
      setFetchError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setFetchError(null);

    getFinanceChartSelectionAction({ view, year: selectedYear, month: selectedMonth, ownerKey }).then((result) => {
      if (cancelled) return;
      setIsLoading(false);
      if ("error" in result) {
        setFetchError(result.error);
        setRemotePoints(null);
        return;
      }
      if (result.view === "month") {
        setRemotePoints({
          month: result.points.map((p) => ({
            label: p.date.slice(8, 10),
            closingBalance: p.closingBalance,
            netCashFlow: p.netCashFlow,
            isCritical: p.isCritical
          }))
        });
      } else {
        setRemotePoints({
          year: result.points.map((p) => ({
            label: formatMonthLabel(p.month),
            closingBalance: p.closingBalance,
            netCashFlow: p.netCashFlow,
            isCritical: p.isCritical
          }))
        });
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedYear, selectedMonth, ownerKey, isDefaultPeriod]);

  const activeSeries = ownerKey === ALL_HOUSEHOLD_KEY ? chart : chart.perMember.find((m) => m.ownerKey === ownerKey);

  const rawPoints = useMemo<RawPoint[]>(() => {
    if (view === "multiYear") {
      return (activeSeries?.multiYear ?? []).map((p) => ({ label: p.year, closingBalance: p.closingBalance, netCashFlow: p.netCashFlow }));
    }

    if (!isDefaultPeriod && remotePoints) {
      if (view === "month" && remotePoints.month) {
        return remotePoints.month;
      }
      if (view === "year" && remotePoints.year) {
        return remotePoints.year;
      }
      return [];
    }

    if (view === "month") {
      return (activeSeries?.month ?? []).map((p) => ({
        label: p.date.slice(8, 10),
        closingBalance: p.closingBalance,
        netCashFlow: p.netCashFlow,
        isCritical: p.isCritical
      }));
    }
    return (activeSeries?.year ?? []).map((p) => ({
      label: formatMonthLabel(p.month),
      closingBalance: p.closingBalance,
      netCashFlow: p.netCashFlow,
      isCritical: p.isCritical
    }));
  }, [view, activeSeries, isDefaultPeriod, remotePoints]);

  const points: Point[] = rawPoints.map((p) => ({
    label: p.label,
    value: valueMode === "accumulated" ? p.closingBalance : p.netCashFlow,
    isCritical: p.isCritical
  }));

  const ownerOptions = [
    { key: ALL_HOUSEHOLD_KEY, label: "Alle (husholdningen samlet)" },
    ...chart.perMember.map((m) => ({ key: m.ownerKey, label: m.ownerLabel }))
  ];

  const xAxisLabel = view === "month" ? "Dag i måneden" : view === "year" ? "Måned" : "År";
  const isHouseholdView = ownerKey === ALL_HOUSEHOLD_KEY;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
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

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {view === "month" || view === "year" ? (
            <label className="flex items-center gap-1">
              År
              <select
                value={selectedYear}
                onChange={(event) => setSelectedYear(Number(event.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {view === "month" ? (
            <label className="flex items-center gap-1">
              Måned
              <select
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(Number(event.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {monthOptionLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-1">
            Vis
            <select
              value={valueMode}
              onChange={(event) => setValueMode(event.target.value as "accumulated" | "period")}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
            >
              <option value="accumulated">Akkumulert</option>
              <option value="period">Per periode</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
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
      </div>

      <div className="mt-4">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-500">Henter data …</p>
        ) : fetchError ? (
          <p className="py-10 text-center text-sm text-red-600">{fetchError}</p>
        ) : (
          <LiquidityChart
            points={points}
            xAxisLabel={xAxisLabel}
            renderAs={valueMode === "accumulated" ? "line" : "bar"}
            emptyMessage="Ingen data for denne visningen ennå."
          />
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {valueMode === "accumulated"
          ? isHouseholdView
            ? "Y-aksen viser akkumulert saldo på likvide kontoer (NOK)."
            : "Y-aksen viser akkumulert netto kontantstrøm (inntekter minus utgifter) for valgt person/kategori, ikke faktisk kontosaldo."
          : "Y-aksen viser netto inntekt/utgift isolert per periode (ikke akkumulert) — grønn betyr overskudd, rød betyr underskudd den perioden."}{" "}
        X-aksen viser {xAxisLabel.toLowerCase()}. Klikk eller hold musepekeren over et punkt for å se nøyaktig verdi. Ren
        modellberegning, ikke finansrådgivning.
      </p>
    </div>
  );
}
