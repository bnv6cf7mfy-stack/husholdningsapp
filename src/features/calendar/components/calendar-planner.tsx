"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  CloudRain,
  CloudSun,
  MapPin,
  Snowflake,
  Sun,
  Trash2,
  User2,
  X
} from "lucide-react";
import {
  archiveCalendarEventAction,
  createCalendarEventAction,
  saveCalendarDayDetailsAction,
  saveTodayMessageAction
} from "@/features/calendar/actions";
import type {
  CalendarChild,
  CalendarEvent,
  ChildcareAssignment,
  DailyMealPlan,
  HouseholdMember,
  RecipeOption,
  TodayPartnerMessage,
  TomorrowWeather
} from "@/features/calendar/types";
import { calendarEventTypeLabels } from "@/features/calendar/types";

type CalendarPlannerProps = {
  householdName: string;
  month: string;
  currentUserName: string;
  children: CalendarChild[];
  initialEvents: CalendarEvent[];
  members: HouseholdMember[];
  initialChildcareAssignments: ChildcareAssignment[];
  initialDailyMealPlans: DailyMealPlan[];
  recipes: RecipeOption[];
  todayMessage: TodayPartnerMessage | null;
  tomorrowWeather: TomorrowWeather;
};

type SmartReminder = {
  id: string;
  severity: "high" | "medium" | "low";
  text: string;
  targetDateKey?: string;
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

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getNextWeekday(date: Date) {
  let next = new Date(date);
  while (next.getDay() === 0 || next.getDay() === 6) {
    next = addDays(next, 1);
  }
  return next;
}

function getWeatherVisual(symbolCode?: string) {
  const code = (symbolCode ?? "").toLowerCase();

  if (code.includes("rain") || code.includes("sleet")) {
    return {
      Icon: CloudRain,
      text: "Regn"
    };
  }

  if (code.includes("snow")) {
    return {
      Icon: Snowflake,
      text: "Snø"
    };
  }

  if (code.includes("clearsky")) {
    return {
      Icon: Sun,
      text: "Klarvær"
    };
  }

  if (code.includes("partlycloudy")) {
    return {
      Icon: CloudSun,
      text: "Delvis skyet"
    };
  }

  if (code.includes("cloudy") || code.includes("fair")) {
    return {
      Icon: Cloud,
      text: "Skyet"
    };
  }

  return {
    Icon: Cloud,
    text: "Ukjent vær"
  };
}

function getInitials(name?: string | null) {
  if (!name) {
    return "-";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "-";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function eventSort(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

export function CalendarPlanner({
  householdName,
  month,
  currentUserName,
  children,
  initialEvents,
  members,
  initialChildcareAssignments,
  initialDailyMealPlans,
  recipes,
  todayMessage,
  tomorrowWeather
}: CalendarPlannerProps) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [messageDraft, setMessageDraft] = useState(todayMessage?.text ?? "");
  const [lastSavedMessage, setLastSavedMessage] = useState(todayMessage?.text ?? "");
  const [messageStatus, setMessageStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [showAllReminders, setShowAllReminders] = useState(false);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<string[]>([]);

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

  const mealByDay = useMemo(() => {
    const map = new Map<string, DailyMealPlan>();
    initialDailyMealPlans.forEach((meal) => {
      map.set(meal.date, meal);
    });
    return map;
  }, [initialDailyMealPlans]);

  const [pending, startTransition] = useTransition();
  const [messagePending, startMessageTransition] = useTransition();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const persistTodayMessage = (nextMessage: string, closeEditorOnSuccess?: boolean) => {
    startMessageTransition(async () => {
      setMessageStatus("saving");

      try {
        const formData = new FormData();
        formData.set("message", nextMessage);

        await saveTodayMessageAction(formData);
        setLastSavedMessage(nextMessage);
        setMessageStatus("saved");
        if (closeEditorOnSuccess) {
          setIsEditingMessage(false);
        }
      } catch {
        setMessageStatus("error");
      }
    });
  };

  useEffect(() => {
    setMessageDraft(todayMessage?.text ?? "");
    setLastSavedMessage(todayMessage?.text ?? "");
  }, [todayMessage?.text]);

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

  const selectedDayEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : [];
  const selectedDayChildcare = selectedDay
    ? childcareByDay.get(selectedDay) ?? { dropoff: null, pickup: null }
    : { dropoff: null, pickup: null };
  const selectedDayMeal = selectedDay ? mealByDay.get(selectedDay) ?? null : null;
  const selectedDayLabel = selectedDay
    ? new Intl.DateTimeFormat("nb-NO", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
      }).format(new Date(`${selectedDay}T00:00:00`))
    : "";

  const today = new Date();
  const todayKey = toDateKey(today);
  const tomorrowKey = toDateKey(addDays(today, 1));
  const nextWeekdayDate = getNextWeekday(addDays(today, 1));
  const nextWeekdayKey = toDateKey(nextWeekdayDate);
  const nextWeekdayLabel = new Intl.DateTimeFormat("nb-NO", { weekday: "short" }).format(nextWeekdayDate);

  const todaysEvents = eventsByDay.get(todayKey) ?? [];
  const todaysChildcare = childcareByDay.get(todayKey) ?? { dropoff: null, pickup: null };
  const todaysDinner = mealByDay.get(todayKey) ?? null;
  const tomorrowsChildcare = childcareByDay.get(tomorrowKey) ?? { dropoff: null, pickup: null };
  const nextWeekdayChildcare = childcareByDay.get(nextWeekdayKey) ?? { dropoff: null, pickup: null };

  const hasTomorrowPickup = Boolean(tomorrowsChildcare.pickup?.assignedPersonName);
  const shouldShowRainwearReminder = tomorrowWeather.isRainExpected && hasTomorrowPickup;
  const weatherVisual = getWeatherVisual(tomorrowWeather.symbolCode);
  const weatherStatus = tomorrowWeather.error
    ? {
        label: "Værdata mangler",
        style: "bg-slate-100 text-slate-700"
      }
    : shouldShowRainwearReminder
      ? {
          label: "Regn + henting",
          style: "bg-rose-100 text-rose-800"
        }
      : tomorrowWeather.isRainExpected
        ? {
            label: "Regn mulig",
            style: "bg-amber-100 text-amber-800"
          }
        : {
            label: "Lite regnrisiko",
            style: "bg-emerald-100 text-emerald-800"
          };

  const weatherReminderText = tomorrowWeather.error
    ? "Vaerdata utilgjengelig akkurat na."
    : shouldShowRainwearReminder
      ? `Regn ca. ${tomorrowWeather.maxPrecipMm} mm. Henting: ${tomorrowsChildcare.pickup?.assignedPersonName ?? "Ikke satt"}. Husk regntoy.`
      : tomorrowWeather.isRainExpected
        ? `Regn ca. ${tomorrowWeather.maxPrecipMm} mm. Henting ikke satt.`
        : `Lite regnrisiko. Henting: ${tomorrowsChildcare.pickup?.assignedPersonName ?? "Ikke satt"}.`;

  const smartReminders = useMemo<SmartReminder[]>(() => {
    const reminders: SmartReminder[] = [];

    if (shouldShowRainwearReminder) {
      reminders.push({
        id: "rainwear",
        severity: "high",
        text: `Regn + henting i morgen (${tomorrowsChildcare.pickup?.assignedPersonName ?? "Ikke satt"}) - husk regntoy`,
        targetDateKey: tomorrowKey
      });
    }

    const isAfterThreePm = today.getHours() >= 15;
    const hasDinnerPlan = Boolean(todaysDinner?.title?.trim());
    if (isAfterThreePm && !hasDinnerPlan) {
      reminders.push({
        id: "dinner-missing",
        severity: "medium",
        text: "Kl. 15+ og ingen middag satt i dag",
        targetDateKey: todayKey
      });
    }

    const missingAssignments: string[] = [];
    if (!nextWeekdayChildcare.dropoff?.assignedPersonId) {
      missingAssignments.push("L");
    }
    if (!nextWeekdayChildcare.pickup?.assignedPersonId) {
      missingAssignments.push("H");
    }

    if (missingAssignments.length > 0) {
      reminders.push({
        id: "next-weekday-childcare",
        severity: "medium",
        text: `${nextWeekdayLabel}: mangler ${missingAssignments.join("/")} i barnehage`,
        targetDateKey: nextWeekdayKey
      });
    }

    if (reminders.length === 0) {
      reminders.push({
        id: "all-good",
        severity: "low",
        text: "Ingen kritiske paminnelser akkurat na."
      });
    }

    return reminders;
  }, [
    nextWeekdayKey,
    nextWeekdayChildcare.dropoff?.assignedPersonId,
    nextWeekdayChildcare.pickup?.assignedPersonId,
    nextWeekdayLabel,
    shouldShowRainwearReminder,
    today,
    todayKey,
    todaysDinner?.title,
    tomorrowKey,
    tomorrowsChildcare.pickup?.assignedPersonName
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(`calendar:done-reminders:${todayKey}`);
      if (!raw) {
        setDismissedReminderIds([]);
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setDismissedReminderIds(parsed.filter((value): value is string => typeof value === "string"));
      } else {
        setDismissedReminderIds([]);
      }
    } catch {
      setDismissedReminderIds([]);
    }
  }, [todayKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(`calendar:done-reminders:${todayKey}`, JSON.stringify(dismissedReminderIds));
  }, [dismissedReminderIds, todayKey]);

  const priorityOrder: Record<SmartReminder["severity"], number> = {
    high: 3,
    medium: 2,
    low: 1
  };

  const sortedReminders = useMemo(() => {
    return [...smartReminders].sort((a, b) => priorityOrder[b.severity] - priorityOrder[a.severity]);
  }, [smartReminders]);

  const activeReminders = useMemo(() => {
    return sortedReminders.filter((reminder) => !dismissedReminderIds.includes(reminder.id));
  }, [dismissedReminderIds, sortedReminders]);

  const visibleReminders = showAllReminders ? activeReminders : activeReminders.slice(0, 2);
  const hiddenReminderCount = Math.max(activeReminders.length - visibleReminders.length, 0);

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
      <section className="rounded-3xl bg-white px-5 py-3 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Kalender</p>
          <h1 className="text-lg font-bold">{householdName}</h1>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Viktig i dag</p>
          {activeReminders.length === 0 ? <p className="text-xs text-slate-500">Alt er markert ferdig i dag.</p> : null}
          {visibleReminders.map((reminder) => {
            const severityStyle =
              reminder.severity === "high"
                ? "bg-rose-100 text-rose-800"
                : reminder.severity === "medium"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-800";

            return (
              <div key={reminder.id} className={`inline-flex items-center gap-1 rounded-full px-1 py-0.5 ${severityStyle}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (reminder.targetDateKey) {
                      setSelectedDay(reminder.targetDateKey);
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-1 text-xs font-medium ${reminder.targetDateKey ? "cursor-pointer" : "cursor-default"}`}
                  title={reminder.text}
                >
                  <Clock3 className="h-3 w-3" />
                  <span className="max-w-[320px] truncate">{reminder.text}</span>
                </button>
                {reminder.id !== "all-good" ? (
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/80 text-slate-700"
                    onClick={() => {
                      setDismissedReminderIds((current) => (current.includes(reminder.id) ? current : [...current, reminder.id]));
                    }}
                    title="Marker som ferdig"
                    aria-label="Marker som ferdig"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            );
          })}
          {hiddenReminderCount > 0 ? (
            <button
              type="button"
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
              onClick={() => setShowAllReminders(true)}
            >
              Vis alle (+{hiddenReminderCount})
            </button>
          ) : null}
          {showAllReminders && activeReminders.length > 2 ? (
            <button
              type="button"
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
              onClick={() => setShowAllReminders(false)}
            >
              Vis færre
            </button>
          ) : null}
          {dismissedReminderIds.length > 0 ? (
            <button
              type="button"
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
              onClick={() => setDismissedReminderIds([])}
            >
              Nullstill ferdige ({dismissedReminderIds.length})
            </button>
          ) : null}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <article className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 sm:col-span-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dagens avtaler</h2>
            {todaysEvents.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Ingen avtaler i dag.</p>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {todaysEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    className="inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    title={event.title}
                  >
                    <span className="mr-1 font-semibold">{event.allDay ? "Hele dagen" : formatDateTime(event.startsAt, false).split(" ").at(-1)}</span>
                    <span className="truncate">{event.title}</span>
                  </span>
                ))}
                {todaysEvents.length > 2 ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">+{todaysEvents.length - 2} flere</span>
                ) : null}
              </div>
            )}
            </article>

            <article className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 sm:col-span-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">BHG</h2>
              <div className="mt-1 flex items-center gap-3">
                {[
                  { key: "L", assignment: todaysChildcare.dropoff },
                  { key: "H", assignment: todaysChildcare.pickup }
                ].map(({ key, assignment }) => {
                  const color = assignment ? memberColorMap.get(assignment.assignedPersonId) : undefined;
                  return (
                    <div key={key} className="flex items-center gap-1" title={assignment?.assignedPersonName ?? "Ikke satt"}>
                      <span className="text-[11px] font-semibold text-slate-500">{key}</span>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                          color ? `${color.bg} ${color.text}` : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {getInitials(assignment?.assignedPersonName)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-1 truncate text-[11px] text-slate-500">L = levering, H = henting</p>
            </article>

            <article className="min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 sm:col-span-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Middag i dag</h2>
              {todaysDinner ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{todaysDinner.title || "Middag"}</span>
                  {todaysDinner.note ? <span className="max-w-full truncate text-xs text-slate-600">{todaysDinner.note}</span> : null}
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">Ikke planlagt enda.</p>
              )}
            </article>

            <article className="col-span-2 min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-800">Beskjed i dag</h2>
              </div>

              {!isEditingMessage ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingMessage(true);
                    setMessageStatus("idle");
                  }}
                  className="mt-1.5 h-12 w-full rounded-md bg-slate-50 px-2 text-left text-sm text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                  title="Trykk for å redigere dagens beskjed"
                >
                  <span className="line-clamp-2 block">
                    {lastSavedMessage.trim() || "Trykk her for å legge inn beskjed"}
                  </span>
                </button>
              ) : (
                <form
                  className="mt-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    persistTodayMessage(messageDraft, true);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <textarea
                      name="message"
                      maxLength={600}
                      value={messageDraft}
                      onChange={(event) => {
                        setMessageDraft(event.target.value);
                        if (messageStatus !== "saving") {
                          setMessageStatus("idle");
                        }
                      }}
                      placeholder="Skriv en kort beskjed til partner for i dag..."
                      className="h-8 min-h-8 min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      rows={1}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white"
                      disabled={messagePending}
                    >
                      {messagePending ? "Lagrer..." : "Lagre"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700"
                      onClick={() => {
                        setMessageDraft(lastSavedMessage);
                        setMessageStatus("idle");
                        setIsEditingMessage(false);
                      }}
                      disabled={messagePending}
                    >
                      Avbryt
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-2 text-[11px]">
                    {messageStatus === "saving" || messagePending ? (
                      <p className="shrink-0 font-medium text-slate-500">Lagrer...</p>
                    ) : null}
                    {messageStatus === "saved" && !messagePending ? (
                      <p className="shrink-0 font-medium text-emerald-700">Lagret</p>
                    ) : null}
                    {messageStatus === "error" ? (
                      <p className="shrink-0 font-medium text-rose-700">Feil ved lagring</p>
                    ) : null}
                  </div>
                </form>
              )}
            </article>
        </div>

        <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-700">I morgen (Yr)</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${weatherStatus.style}`}>
              {weatherStatus.label}
            </span>
            {!tomorrowWeather.error ? (
              <span className="inline-flex items-center gap-1 text-slate-700">
                <weatherVisual.Icon className="h-3.5 w-3.5" />
                <span>
                  {weatherVisual.text}
                  {typeof tomorrowWeather.minTempC === "number" && typeof tomorrowWeather.maxTempC === "number"
                    ? ` ${tomorrowWeather.minTempC}°-${tomorrowWeather.maxTempC}°`
                    : ""}
                </span>
              </span>
            ) : null}
            <p className="min-w-0 flex-1 truncate">{weatherReminderText}</p>
            <p className="hidden shrink-0 text-[11px] text-slate-500 lg:block">Yr · {tomorrowWeather.locationLabel}</p>
          </div>
        </div>
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
              const dinner = mealByDay.get(dayKey);

              return (
                <button
                  type="button"
                  key={dayKey}
                  onClick={() => setSelectedDay(dayKey)}
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
                    {dinner ? (
                      <p className="truncate rounded bg-amber-100 px-1 py-px text-[10px] font-medium leading-tight text-amber-800">
                        M: {dinner.title || "Middag"}
                      </p>
                    ) : null}

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
                </button>
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

      {selectedDay ? (
        <section className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dagdetaljer</p>
                <h2 className="mt-1 text-xl font-bold capitalize">{selectedDayLabel}</h2>
                <p className="mt-1 text-sm text-slate-600">Legg inn barnehage og middag for denne dagen.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700"
                aria-label="Lukk"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              key={selectedDay}
              className="mt-4 grid gap-3 md:grid-cols-2"
              action={(formData) => {
                startTransition(async () => {
                  await saveCalendarDayDetailsAction(formData);
                  setSelectedDay(null);
                  router.refresh();
                });
              }}
            >
              <input type="hidden" name="date" value={selectedDay} />

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Levering (barnehage)</span>
                <select
                  name="dropoffProfileId"
                  defaultValue={selectedDayChildcare.dropoff?.assignedPersonId ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3"
                >
                  <option value="">Ingen</option>
                  {members.map((member) => (
                    <option key={member.profileId} value={member.profileId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Henting (barnehage)</span>
                <select
                  name="pickupProfileId"
                  defaultValue={selectedDayChildcare.pickup?.assignedPersonId ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3"
                >
                  <option value="">Ingen</option>
                  {members.map((member) => (
                    <option key={member.profileId} value={member.profileId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Oppskrift (valgfritt)</span>
                <select
                  name="dinnerRecipeId"
                  defaultValue={selectedDayMeal?.recipeId ?? ""}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3"
                >
                  <option value="">Ingen oppskrift</option>
                  {recipes.map((recipe) => (
                    <option key={recipe.id} value={recipe.id}>
                      {recipe.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Middag</span>
                <input
                  name="dinnerTitle"
                  defaultValue={selectedDayMeal?.customTitle ?? ""}
                  placeholder="F.eks. Pasta med kylling (overstyring av oppskriftsnavn)"
                  className="h-10 w-full rounded-lg border border-slate-300 px-3"
                />
              </label>

              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Middagsnotat</span>
                <textarea
                  name="dinnerNote"
                  defaultValue={selectedDayMeal?.note ?? ""}
                  rows={2}
                  placeholder="Allergi, prep, hvem handler..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <div className="md:col-span-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
                  disabled={pending}
                >
                  {pending ? "Lagrer..." : "Lagre dag"}
                </button>
              </div>
            </form>

            <div className="mt-4 rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-700">Avtaler denne dagen</p>
              <div className="mt-2 space-y-2">
                {selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">Ingen avtaler denne dagen.</p>
                ) : (
                  selectedDayEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{event.title}</p>
                        <p className="text-xs text-slate-500">
                          {event.allDay ? "Hele dagen" : formatDateTime(event.startsAt, false).split(" ").at(-1)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => archiveEvent(event.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 text-slate-600"
                        aria-label={`Slett ${event.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
