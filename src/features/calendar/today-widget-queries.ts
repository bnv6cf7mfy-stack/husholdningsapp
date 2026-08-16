import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, type CurrentMembership } from "@/features/household/queries";
import { getTomorrowWeatherSummary } from "@/lib/weather/yr";
import type {
  CalendarEvent,
  ChildcareAssignment,
  DailyMealPlan,
  HouseholdMember,
  TodayPartnerMessage,
  TomorrowWeather
} from "@/features/calendar/types";

const TODAY_MESSAGE_LOCATION = "__today_message__";

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type TodayWidgetData = {
  householdName: string;
  todaysEvents: CalendarEvent[];
  todaysChildcare: { dropoff: ChildcareAssignment | null; pickup: ChildcareAssignment | null };
  tomorrowsChildcare: { dropoff: ChildcareAssignment | null; pickup: ChildcareAssignment | null };
  todaysDinner: DailyMealPlan | null;
  tomorrowWeather: TomorrowWeather;
  todayMessage: TodayPartnerMessage | null;
  members: HouseholdMember[];
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

export async function getTodayWidgetData(membershipOverride?: CurrentMembership): Promise<TodayWidgetData | null> {
  const membership = membershipOverride ?? (await getCurrentMembership());
  if (!membership) return null;

  const adminSupabase = createAdminSupabaseClient();

  const now = new Date();
  const todayKey = toDateStr(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = toDateStr(tomorrow);
  const weatherFallback: TomorrowWeather = {
    source: "yr",
    tomorrowDate: tomorrowKey,
    locationLabel: process.env.YR_LOCATION_LABEL ?? "Bekkestua",
    isRainExpected: false,
    maxPrecipMm: 0,
    error: "Værdata utilgjengelig"
  };

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [eventsResult, childcareResult, mealResult, messageResult, membersResult, weatherResult] =
    await Promise.all([
      // Today's events
      adminSupabase
        .from("calendar_events")
        .select("id, title, description, location, starts_at, ends_at, all_day, event_type, created_by")
        .eq("household_id", membership.householdId)
        .is("archived_at", null)
        .neq("location", TODAY_MESSAGE_LOCATION)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("starts_at", { ascending: true }),
      // Childcare for today + tomorrow
      adminSupabase
        .from("childcare_assignments")
        .select("id, date, assignment_type, assigned_person_id")
        .eq("household_id", membership.householdId)
        .in("date", [todayKey, tomorrowKey]),
      // Today's dinner
      adminSupabase
        .from("meal_plans")
        .select("id, meal_date, custom_title, note, recipe_id")
        .eq("household_id", membership.householdId)
        .eq("meal_type", "dinner")
        .eq("meal_date", todayKey)
        .limit(1)
        .maybeSingle(),
      // Today's partner message
      adminSupabase
        .from("calendar_events")
        .select("description, updated_at, created_by")
        .eq("household_id", membership.householdId)
        .eq("location", TODAY_MESSAGE_LOCATION)
        .is("archived_at", null)
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Members for childcare person names
      adminSupabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", membership.householdId)
        .order("joined_at", { ascending: true }),
      withTimeout(getTomorrowWeatherSummary(), 1200, weatherFallback)
    ]);

  const memberProfileIds = (membersResult.data ?? []).map((r) => r.user_id);
  const personNameMap = new Map<string, string>();

  if (memberProfileIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", memberProfileIds);
    (profiles ?? []).forEach((p) => personNameMap.set(p.id, p.display_name));
  }

  const members: HouseholdMember[] = memberProfileIds.map((id, idx) => ({
    profileId: id,
    displayName: personNameMap.get(id) ?? `Bruker ${idx + 1}`
  }));

  const childcareRows = childcareResult.data ?? [];
  const todayChildcareRows = childcareRows.filter((r) => r.date === todayKey);
  const tomorrowChildcareRows = childcareRows.filter((r) => r.date === tomorrowKey);

  function toAssignment(
    row: (typeof childcareRows)[number]
  ): ChildcareAssignment {
    return {
      id: row.id,
      date: row.date,
      assignmentType: row.assignment_type as "dropoff" | "pickup",
      assignedPersonId: row.assigned_person_id,
      assignedPersonName: personNameMap.get(row.assigned_person_id) ?? "Ukjent"
    };
  }

  const todaysChildcare = {
    dropoff: todayChildcareRows.find((r) => r.assignment_type === "dropoff")
      ? toAssignment(todayChildcareRows.find((r) => r.assignment_type === "dropoff")!)
      : null,
    pickup: todayChildcareRows.find((r) => r.assignment_type === "pickup")
      ? toAssignment(todayChildcareRows.find((r) => r.assignment_type === "pickup")!)
      : null
  };

  const tomorrowsChildcare = {
    dropoff: tomorrowChildcareRows.find((r) => r.assignment_type === "dropoff")
      ? toAssignment(tomorrowChildcareRows.find((r) => r.assignment_type === "dropoff")!)
      : null,
    pickup: tomorrowChildcareRows.find((r) => r.assignment_type === "pickup")
      ? toAssignment(tomorrowChildcareRows.find((r) => r.assignment_type === "pickup")!)
      : null
  };

  let todaysDinner: DailyMealPlan | null = null;
  if (mealResult.data) {
    const row = mealResult.data;
    let recipeName: string | null = null;
    if (row.recipe_id) {
      const { data: recipe } = await adminSupabase
        .from("recipes")
        .select("name")
        .eq("id", row.recipe_id)
        .maybeSingle();
      recipeName = recipe?.name ?? null;
    }
    todaysDinner = {
      id: row.id,
      date: row.meal_date,
      recipeId: row.recipe_id,
      recipeName,
      customTitle: row.custom_title,
      title: row.custom_title ?? recipeName,
      note: row.note
    };
  }

  const todayMessage: TodayPartnerMessage | null =
    messageResult.data?.description?.trim()
      ? {
          text: messageResult.data.description,
          updatedAt: messageResult.data.updated_at,
          updatedByName: personNameMap.get(messageResult.data.created_by) ?? "Ukjent"
        }
      : null;

  const creatorIds = Array.from(new Set((eventsResult.data ?? []).map((r) => r.created_by)));
  const creatorMap = new Map<string, string>(
    [...personNameMap].map(([id, name]) => [id, name])
  );
  if (creatorIds.filter((id) => !creatorMap.has(id)).length > 0) {
    const { data: creators } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", creatorIds);
    (creators ?? []).forEach((c) => creatorMap.set(c.id, c.display_name));
  }

  const todaysEvents: CalendarEvent[] = (eventsResult.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    eventType: row.event_type,
    createdByName: creatorMap.get(row.created_by) ?? "Ukjent",
    children: []
  }));

  return {
    householdName: membership.householdName,
    todaysEvents,
    todaysChildcare,
    tomorrowsChildcare,
    todaysDinner,
    tomorrowWeather: weatherResult,
    todayMessage,
    members
  };
}
