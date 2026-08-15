import { redirect } from "next/navigation";
import { CalendarPlanner } from "@/features/calendar/components/calendar-planner";
import { getCalendarData } from "@/features/calendar/queries";

type CalendarPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = await searchParams;
  const data = await getCalendarData(resolvedSearchParams?.month);

  if (!data) {
    redirect("/onboarding");
  }

  return (
    <CalendarPlanner
      householdName={data.householdName}
      month={data.month}
      currentUserName={data.currentUserName}
      children={data.children}
      initialEvents={data.events}
      members={data.members}
      initialChildcareAssignments={data.childcareAssignments}
      initialDailyMealPlans={data.dailyMealPlans}
      tomorrowWeather={data.tomorrowWeather}
    />
  );
}
