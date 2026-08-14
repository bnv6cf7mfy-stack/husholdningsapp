"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, School, Trash2, User2 } from "lucide-react";
import { archiveCalendarEventAction, createCalendarEventAction, saveChildcareWeekAction } from "@/features/calendar/actions";
import type { CalendarChild, CalendarEvent, ChildcareAssignment, HouseholdMember } from "@/features/calendar/types";
import { calendarEventTypeLabels } from "@/features/calendar/types";

type CalendarPlannerProps = {
  householdName: string;
  month: string;
  currentUserName: string;
  children: CalendarChild[];
  initialEvents: CalendarEvent[];
  members: HouseholdMember[];
  initialChildcareAssignments: ChildcareAssignment[];
};

// Deterministic color palette per household member (by join order)
const MEMBER_COLORS = [
  { bg: "bg-sky-100",     text: "text-sky-800",     dot: "bg-sky-500"     },
  { bg: "bg-rose-100",    text: "text-rose-800",    dot: "bg-rose-500"    },
  { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
  { bg: "bg-amber-100",   text: "text-amber-800",   dot: "bg-amber-500"   },
  { bg: "bg-violet-100",  text: "text-violet-800",  dot: "bg-violet-500"  },
];

const eventTypeColors: Record<string, string> = {
  general: "bg-slate-200 text-slate-700",
  child: "bg-sky-100 text-sky-800",
  family: "bg-emerald-100 text-emerald-800",
  appointment: "bg-amber-100 text-amber-800",
  work: "bg-indigo-100 text-indigo-800",
  activity: "bg-rose-100 text-rose-800",
  other: "bg-violet-100 text-violet-800"
};

const weekDayLabels = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function parseMonthKey(month: string) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return new Date(year, monthIndex, 1);
}

function formatDateTime(value: string, allDay: boolean) {
  const date = new Date(value);

  if (allDay) {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function eventSort(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftWeek(mondayStr: string, weeks: number): string {
  const d = new Date(`${mondayStr}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDaysToStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarPlanner({
  householdName,
  month,
  currentUserName,
  children,
  initialEvents,
  members,
  initialChildcareAssignments
}: CalendarPlannerProps) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);

  // Map profileId -> color index for consistent per-person colors
  const memberColorMap = useMemo(() => {
    const map = new Map<string, (typeof MEMBER_COLORS)[number]>();
    members.forEach((member, index) => {
      map.set(member.profileId, MEMBER_COLORS[index % MEMBER_COLORS.length]);
    });
    return map;
  }, [members]);

  // Map date string (YYYY-MM-DD) -> { dropoff, pickup } assignments
  const childcareByDay = useMemo(() => {
    const map = new Map<string, { dropoff: ChildcareAssignment | null; pickup: ChildcareAssignment | null }>();
    initialChildcareAssignments.forEach((assignment) => {
      const existing = map.get(assignment.date) ?? { dropoff: null, pickup: null };
      if (assignment.assignmentType === "dropoff") {
        map.set(assignment.date, { ...existing, dropoff: assignment });
      } else {
        map.set(assignment.date, { ...existing, pickup: assignment });
      }
    });
    return map;
  }, [initialChildcareAssignments]);
  const [pending, startTransition] = useTransition();
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeek(new Date()));

  const weekDayDates = useMemo(
    () => [0, 1, 2, 3, 4].map((offset) => addDaysToStr(weekStart, offset)),
    [weekStart]
  );

  const weekLabel = useMemo(() => {
    const d = new Date(`${weekStart}T00:00:00`);
    return new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" }).format(d);
  }, [weekStart]);

  const monthDate = useMemo(() => parseMonthKey(month), [month]);

  const monthLabel = new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric"
  }).format(monthDate);

  const monthGridDays = useMemo(() => {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [monthDate]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    events.forEach((event) => {
      const date = new Date(event.startsAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const bucket = map.get(key) ?? [];
      map.set(key, [...bucket, event]);
    });

    map.forEach((value, key) => {
      map.set(key, [...value].sort(eventSort));
    });

    return map;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();

    return [...events]
      .filter((event) => new Date(event.endsAt).getTime() >= now)
      .sort(eventSort)
      .slice(0, 8);
  }, [events]);

  const goToMonth = (direction: -1 | 1) => {
    const nextDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
    const nextKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    router.push(`/calendar?month=${nextKey}` as Route);
  };

  const archiveEvent = (eventId: string) => {
    const previous = events;
    setEvents((current) => current.filter((event) => event.id !== eventId));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("eventId", eventId);

      await archiveCalendarEventAction(formData);
      router.refresh();
    });

    return previous;
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Kalender</p>
        <h1 className="mt-2 text-3xl font-bold">{householdName}</h1>
        <p className="mt-3 text-sm text-slate-600">
          Planlegg familiens uke med tydelig månedsvisning, rask registrering og kobling til barn.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <header className="flex items-center justify-between">
            <button
              onClick={() => goToMonth(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700"
              aria-label="Forrige måned"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-bold capitalize">{monthLabel}</h2>
            <button
              onClick={() => goToMonth(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-slate-700"
              aria-label="Neste måned"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </header>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
            {weekDayLabels.map((label) => (
              <div key={label} className="py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthGridDays.map((day) => {
              const dayKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
              const dayEvents = eventsByDay.get(dayKey) ?? [];
              const inCurrentMonth = day.getMonth() === monthDate.getMonth();
              // 0=Mon…4=Fri in our grid, 5=Sat, 6=Sun
              const weekdayIndex = (day.getDay() + 6) % 7;
              const isWeekday = weekdayIndex <= 4;
              const childcare = isWeekday ? childcareByDay.get(dayKey) : undefined;

              return (
                <div
                  key={dayKey}
                  className={`min-h-24 rounded-xl border p-1.5 ${inCurrentMonth ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}
                >
                  <p className={`text-xs font-semibold leading-none ${inCurrentMonth ? "text-slate-700" : "text-slate-400"}`}>{day.getDate()}</p>

                  {/* Barnehage-badges kun på hverdager */}
                  {isWeekday && (
                    <div className="mt-1 flex flex-col gap-0.5">
                      {["dropoff", "pickup"].map((type) => {
                        const assignment = type === "dropoff" ? childcare?.dropoff : childcare?.pickup;
                        const color = assignment ? memberColorMap.get(assignment.assignedPersonId) : undefined;
                        const label = type === "dropoff" ? "L" : "H";
                        const firstName = assignment?.assignedPersonName.split(" ")[0] ?? "";

                        return (
                          <div
                            key={type}
                            className={`flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium leading-tight ${
                              color ? `${color.bg} ${color.text}` : "bg-slate-100 text-slate-400"
                            }`}
                            title={assignment ? `${type === "dropoff" ? "Levering" : "Henting"}: ${assignment.assignedPersonName}` : undefined}
                          >
                            <span className="shrink-0 font-bold">{label}:</span>
                            <span className="truncate">{firstName || "–"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <p
                        key={event.id}
                        className={`truncate rounded px-1 py-px text-[10px] leading-tight ${eventTypeColors[event.eventType] ?? eventTypeColors.general}`}
                        title={event.title}
                      >
                        {event.allDay ? "●" : formatDateTime(event.startsAt, false).split(" ").at(-1)} {event.title}
                      </p>
                    ))}
                    {dayEvents.length > 2 ? <p className="text-[10px] text-slate-400">+{dayEvents.length - 2}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Neste avtaler
          </h2>
          <div className="mt-3 space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen kommende avtaler.</p>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDateTime(event.startsAt, event.allDay)}
                        {!event.allDay ? ` - ${formatDateTime(event.endsAt, false).split(" ").at(-1)}` : ""}
                      </p>
                    </div>
                    <button
                      aria-label={`Fjern ${event.title}`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600"
                      onClick={() => archiveEvent(event.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${eventTypeColors[event.eventType] ?? eventTypeColors.general}`}
                    >
                      {calendarEventTypeLabels[event.eventType]}
                    </span>
                    {event.children.map((child) => (
                      <span key={child.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {child.firstName}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {event.location ? (
                      <p className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.location}
                      </p>
                    ) : null}
                    <p className="flex items-center gap-1">
                      <User2 className="h-3.5 w-3.5" />
                      Opprettet av {event.createdByName}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      {/* Barnehage uke-planner */}
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <School className="h-4 w-4 text-primary" />
          Barnehageuker
        </h2>
        <p className="mt-1 text-sm text-slate-600">Sett hvem som leverer (L) og henter (H) – vises direkte i kalenderen.</p>

        {/* Fargeforklaring per person */}
        {members.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {members.map((member, index) => {
              const color = MEMBER_COLORS[index % MEMBER_COLORS.length];
              return (
                <span key={member.profileId} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}>
                  {member.displayName.split(" ")[0]}
                </span>
              );
            })}
          </div>
        )}

        {/* Ukenavigering */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setWeekStart((current) => shiftWeek(current, -1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700"
            aria-label="Forrige uke"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-slate-700">Uke fra {weekLabel}</span>
          <button
            type="button"
            onClick={() => setWeekStart((current) => shiftWeek(current, 1))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700"
            aria-label="Neste uke"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {members.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Ingen husholdningsmedlemmer funnet.</p>
        ) : (
          <form
            key={weekStart}
            className="mt-4"
            action={(formData) => {
              startTransition(async () => {
                await saveChildcareWeekAction(formData);
                router.refresh();
              });
            }}
          >
            <input type="hidden" name="weekStart" value={weekStart} />

            <div className="grid grid-cols-5 gap-2">
              {weekDayDates.map((dateStr, dayIndex) => {
                const existing = childcareByDay.get(dateStr);
                const dayNames = ["Man", "Tir", "Ons", "Tor", "Fre"];
                const dayNum = Number(dateStr.split("-")[2]);

                return (
                  <div key={dateStr} className="rounded-xl border border-slate-200 p-2">
                    <p className="text-center text-[11px] font-bold text-slate-700">
                      {dayNames[dayIndex]}
                      <span className="ml-1 font-normal text-slate-400">{dayNum}.</span>
                    </p>

                    <div className="mt-2 space-y-1.5">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">L</p>
                        <select
                          name="dropoff"
                          defaultValue={
                            existing?.dropoff ? `${dayIndex}:${existing.dropoff.assignedPersonId}` : ""
                          }
                          className="mt-0.5 w-full rounded-md border border-slate-200 py-1 pl-1 text-[11px]"
                        >
                          <option value="">–</option>
                          {members.map((member) => (
                            <option key={member.profileId} value={`${dayIndex}:${member.profileId}`}>
                              {member.displayName.split(" ")[0]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-400">H</p>
                        <select
                          name="pickup"
                          defaultValue={
                            existing?.pickup ? `${dayIndex}:${existing.pickup.assignedPersonId}` : ""
                          }
                          className="mt-0.5 w-full rounded-md border border-slate-200 py-1 pl-1 text-[11px]"
                        >
                          <option value="">–</option>
                          {members.map((member) => (
                            <option key={member.profileId} value={`${dayIndex}:${member.profileId}`}>
                              {member.displayName.split(" ")[0]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
                disabled={pending}
              >
                {pending ? "Lagrer..." : "Lagre uke"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-bold">Ny avtale</h2>
        <p className="mt-1 text-sm text-slate-600">Legg inn avtale eller aktivitet raskt, slik i standard kalenderapper.</p>

        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          action={(formData) => {
            startTransition(async () => {
              await createCalendarEventAction(formData);
              router.refresh();
            });
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Tittel</span>
            <input
              name="title"
              required
              placeholder="F.eks. Kontroll hos helsestasjon"
              className="h-10 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Kategori</span>
            <select name="eventType" defaultValue="general" className="h-10 w-full rounded-lg border border-slate-300 px-3">
              {Object.entries(calendarEventTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Dato</span>
            <input
              name="date"
              type="date"
              required
              defaultValue={`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`}
              className="h-10 w-full rounded-lg border border-slate-300 px-3"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700">
            <input type="checkbox" name="allDay" className="h-4 w-4" />
            Hele dagen
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Starttid</span>
            <input name="startTime" type="time" defaultValue="08:00" className="h-10 w-full rounded-lg border border-slate-300 px-3" />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Sluttid</span>
            <input name="endTime" type="time" defaultValue="09:00" className="h-10 w-full rounded-lg border border-slate-300 px-3" />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Sted</span>
            <input name="location" placeholder="F.eks. Solsikken barnehage" className="h-10 w-full rounded-lg border border-slate-300 px-3" />
          </label>

          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium text-slate-700">Beskrivelse</span>
            <textarea
              name="description"
              rows={3}
              placeholder="Ekstra info, pakkeliste, kontaktperson..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <fieldset className="md:col-span-2">
            <legend className="text-sm font-medium text-slate-700">Knytt til barn (valgfritt)</legend>
            {children.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Ingen barn registrert enda.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {children.map((child) => (
                  <label key={child.id} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-sm">
                    <input type="checkbox" name="childIds" value={child.id} className="h-4 w-4" />
                    {child.firstName}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
              disabled={pending}
            >
              <Clock3 className="h-4 w-4" />
              {pending ? "Lagrer..." : `Lagre som ${currentUserName}`}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
