import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/features/household/queries";
import { getTomorrowWeatherSummary } from "@/lib/weather/yr";
import type {
  CalendarChild,
  CalendarEvent,
  ChildcareAssignment,
  DailyMealPlan,
  HouseholdMember,
  TomorrowWeather
} from "@/features/calendar/types";

export type CalendarData = {
  householdName: string;
  currentUserName: string;
  month: string;
  children: CalendarChild[];
  events: CalendarEvent[];
  members: HouseholdMember[];
  childcareAssignments: ChildcareAssignment[];
  dailyMealPlans: DailyMealPlan[];
  tomorrowWeather: TomorrowWeather;
};

function parseMonth(monthInput?: string) {
  const match = /^\d{4}-\d{2}$/.test(monthInput ?? "") ? monthInput : null;
  const base = match ? new Date(`${match}-01T00:00:00`) : new Date();

  const year = base.getFullYear();
  const month = base.getMonth();
  const firstDay = new Date(year, month, 1, 0, 0, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const queryStart = new Date(firstDay);
  queryStart.setDate(queryStart.getDate() - 7);

  const queryEnd = new Date(lastDay);
  queryEnd.setDate(queryEnd.getDate() + 7);

  const key = `${year}-${String(month + 1).padStart(2, "0")}`;

  return { firstDay, lastDay, queryStart, queryEnd, key };
}

export async function getCalendarData(monthInput?: string): Promise<CalendarData | null> {
  const membership = await getCurrentMembership();

  if (!membership) {
    return null;
  }

  const range = parseMonth(monthInput);
  const adminSupabase = createAdminSupabaseClient();
  const supabase = await createServerSupabaseClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let currentUserName = "Deg";

  if (user?.id) {
    const { data: currentProfile } = await adminSupabase
      .from("profiles")
      .select("display_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (currentProfile?.display_name) {
      currentUserName = currentProfile.display_name;
    }
  }

  const { data: childrenRows } = await adminSupabase
    .from("children")
    .select("id, first_name")
    .eq("household_id", membership.householdId)
    .eq("active", true)
    .is("archived_at", null)
    .order("first_name", { ascending: true });

  const children: CalendarChild[] =
    childrenRows?.map((row) => ({
      id: row.id,
      firstName: row.first_name
    })) ?? [];

  const { data: eventRows } = await adminSupabase
    .from("calendar_events")
    .select("id, title, description, location, starts_at, ends_at, all_day, event_type, created_by")
    .eq("household_id", membership.householdId)
    .is("archived_at", null)
    .gte("starts_at", range.queryStart.toISOString())
    .lte("starts_at", range.queryEnd.toISOString())
    .order("starts_at", { ascending: true });

  const eventIds = (eventRows ?? []).map((row) => row.id);
  const creatorIds = Array.from(new Set((eventRows ?? []).map((row) => row.created_by).filter(Boolean)));

  const creatorMap = new Map<string, string>();

  if (creatorIds.length > 0) {
    const { data: creators } = await adminSupabase.from("profiles").select("id, display_name").in("id", creatorIds);

    (creators ?? []).forEach((creator) => {
      creatorMap.set(creator.id, creator.display_name);
    });
  }

  const childMap = new Map(children.map((child) => [child.id, child]));
  const eventChildrenMap = new Map<string, CalendarChild[]>();

  if (eventIds.length > 0) {
    const { data: eventChildrenRows } = await adminSupabase
      .from("calendar_event_children")
      .select("calendar_event_id, child_id")
      .eq("household_id", membership.householdId)
      .in("calendar_event_id", eventIds);

    (eventChildrenRows ?? []).forEach((row) => {
      const child = childMap.get(row.child_id);

      if (!child) {
        return;
      }

      const existing = eventChildrenMap.get(row.calendar_event_id) ?? [];
      eventChildrenMap.set(row.calendar_event_id, [...existing, child]);
    });
  }

  const events: CalendarEvent[] =
    eventRows?.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      allDay: row.all_day,
      eventType: row.event_type,
      createdByName: creatorMap.get(row.created_by) ?? "Ukjent",
      children: eventChildrenMap.get(row.id) ?? []
    })) ?? [];

  // Household members for color assignment
  const { data: memberRows } = await adminSupabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", membership.householdId)
    .order("joined_at", { ascending: true });

  const memberProfileIds = (memberRows ?? []).map((row) => row.user_id).filter(Boolean);
  const memberProfileMap = new Map<string, string>();

  if (memberProfileIds.length > 0) {
    const { data: memberProfiles } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", memberProfileIds);

    (memberProfiles ?? []).forEach((profile) => {
      memberProfileMap.set(profile.id, profile.display_name);
    });
  }

  const members: HouseholdMember[] = memberProfileIds
    .filter((id) => memberProfileMap.has(id))
    .map((id) => ({
      profileId: id,
      displayName: memberProfileMap.get(id)!
    }));

  // Childcare assignments for the date range
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const { data: assignmentRows } = await adminSupabase
    .from("childcare_assignments")
    .select("id, date, assignment_type, assigned_person_id")
    .eq("household_id", membership.householdId)
    .gte("date", toDateStr(range.queryStart))
    .lte("date", toDateStr(range.queryEnd))
    .order("date", { ascending: true });

  const allPersonIds = Array.from(
    new Set((assignmentRows ?? []).map((row) => row.assigned_person_id).filter(Boolean))
  );
  const personNameMap = new Map<string, string>(memberProfileMap);

  const missingIds = allPersonIds.filter((id) => !personNameMap.has(id));

  if (missingIds.length > 0) {
    const { data: extraProfiles } = await adminSupabase
      .from("profiles")
      .select("id, display_name")
      .in("id", missingIds);

    (extraProfiles ?? []).forEach((p) => personNameMap.set(p.id, p.display_name));
  }

  const childcareAssignments: ChildcareAssignment[] =
    (assignmentRows ?? []).map((row) => ({
      id: row.id,
      date: row.date,
      assignmentType: row.assignment_type as "dropoff" | "pickup",
      assignedPersonId: row.assigned_person_id,
      assignedPersonName: personNameMap.get(row.assigned_person_id) ?? "Ukjent"
    }));

  const { data: mealRows } = await adminSupabase
    .from("meal_plans")
    .select("id, meal_date, custom_title, note, meal_type")
    .eq("household_id", membership.householdId)
    .eq("meal_type", "dinner")
    .gte("meal_date", toDateStr(range.queryStart))
    .lte("meal_date", toDateStr(range.queryEnd))
    .order("updated_at", { ascending: false });

  const mealByDate = new Map<string, DailyMealPlan>();

  (mealRows ?? []).forEach((row) => {
    if (!mealByDate.has(row.meal_date)) {
      mealByDate.set(row.meal_date, {
        id: row.id,
        date: row.meal_date,
        title: row.custom_title,
        note: row.note
      });
    }
  });

  const dailyMealPlans = Array.from(mealByDate.values());
  const tomorrowWeather = await getTomorrowWeatherSummary();

  return {
    householdName: membership.householdName,
    currentUserName,
    month: range.key,
    children,
    events,
    members,
    childcareAssignments,
    dailyMealPlans,
    tomorrowWeather
  };
}
