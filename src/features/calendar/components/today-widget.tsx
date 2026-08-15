import Link from "next/link";
import {
  CloudRain,
  CloudSun,
  Cloud,
  Sun,
  Snowflake,
  Clock3,
  CalendarDays,
  MessageSquare
} from "lucide-react";
import type { TodayWidgetData } from "@/features/calendar/today-widget-queries";

function getInitials(name?: string | null) {
  if (!name) return "–";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "–";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getWeatherVisual(symbolCode?: string) {
  if (!symbolCode) return { Icon: Cloud, text: "Ukjent" };
  if (symbolCode.includes("rain") || symbolCode.includes("shower"))
    return { Icon: CloudRain, text: "Regn" };
  if (symbolCode.includes("snow") || symbolCode.includes("sleet"))
    return { Icon: Snowflake, text: "Snø/sludd" };
  if (symbolCode.includes("cloudy") || symbolCode.includes("cloud"))
    return { Icon: CloudSun, text: "Skyet" };
  return { Icon: Sun, text: "Klarvær" };
}

function formatEventTime(iso: string, allDay: boolean) {
  if (allDay) return "Hele dagen";
  return new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso)
  );
}

const MEMBER_COLORS = [
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-violet-100", text: "text-violet-800" }
];

export function TodayWidget({ data }: { data: TodayWidgetData }) {
  const memberColorMap = new Map(
    data.members.map((m, i) => [m.profileId, MEMBER_COLORS[i % MEMBER_COLORS.length]])
  );

  const weather = data.tomorrowWeather;
  const weatherVisual = getWeatherVisual(weather.symbolCode);
  const hasRainAndPickup =
    weather.isRainExpected && Boolean(data.tomorrowsChildcare.pickup?.assignedPersonName);

  const weatherBadgeStyle = weather.error
    ? "bg-slate-100 text-slate-500"
    : hasRainAndPickup
      ? "bg-rose-100 text-rose-800"
      : weather.isRainExpected
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";

  const weatherBadgeLabel = weather.error
    ? "Ikke tilgjengelig"
    : hasRainAndPickup
      ? "Regn + henting"
      : weather.isRainExpected
        ? "Regn mulig"
        : "Lite regnrisiko";

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Viktig i dag</h2>
        </div>
        <Link
          href="/calendar"
          prefetch={false}
          className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          Åpne kalender
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Today's events */}
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Avtaler i dag
          </p>
          {data.todaysEvents.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">Ingen</p>
          ) : (
            <div className="mt-1 space-y-1">
              {data.todaysEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center gap-1">
                  <Clock3 className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate text-xs font-medium text-slate-700">
                    {formatEventTime(event.startsAt, event.allDay)} {event.title}
                  </span>
                </div>
              ))}
              {data.todaysEvents.length > 3 && (
                <p className="text-[11px] text-slate-400">
                  +{data.todaysEvents.length - 3} flere
                </p>
              )}
            </div>
          )}
        </div>

        {/* BHG childcare */}
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">BHG i dag</p>
          <div className="mt-2 flex items-center gap-3">
            {(
              [
                { label: "Levering", value: data.todaysChildcare.dropoff },
                { label: "Henting", value: data.todaysChildcare.pickup }
              ] as const
            ).map(({ label, value }) => {
              const color = value ? memberColorMap.get(value.assignedPersonId) : undefined;
              return (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">{label.slice(0, 1)}</span>
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                      color ? `${color.bg} ${color.text}` : "bg-slate-100 text-slate-400"
                    }`}
                    title={value?.assignedPersonName ?? "Ikke satt"}
                  >
                    {getInitials(value?.assignedPersonName)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tonight's dinner */}
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Middag</p>
          {data.todaysDinner?.title ? (
            <p className="mt-1 truncate text-sm font-medium text-amber-800">
              {data.todaysDinner.title}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Ikke planlagt</p>
          )}
        </div>

        {/* Tomorrow weather */}
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Vær i morgen
          </p>
          <div className="mt-1 flex items-center gap-1">
            <weatherVisual.Icon className="h-4 w-4 shrink-0 text-slate-600" />
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${weatherBadgeStyle}`}>
              {weatherBadgeLabel}
            </span>
          </div>
          {!weather.error && typeof weather.minTempC === "number" && typeof weather.maxTempC === "number" && (
            <p className="mt-1 text-xs text-slate-500">
              {weather.minTempC}°–{weather.maxTempC}°
            </p>
          )}
        </div>
      </div>

      {/* Today's partner message */}
      {data.todayMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-primary/5 p-3 ring-1 ring-primary/10">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold text-primary">{data.todayMessage.updatedByName}</p>
            <p className="mt-0.5 text-sm text-slate-800">{data.todayMessage.text}</p>
          </div>
        </div>
      )}
    </section>
  );
}
