export const calendarEventTypeLabels = {
  general: "Generelt",
  child: "Barn",
  family: "Familie",
  appointment: "Avtale",
  work: "Jobb",
  activity: "Aktivitet",
  other: "Annet"
} as const;

export type CalendarEventType = keyof typeof calendarEventTypeLabels;

export type CalendarChild = {
  id: string;
  firstName: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  eventType: CalendarEventType;
  createdByName: string;
  children: CalendarChild[];
};

export type HouseholdMember = {
  profileId: string;
  displayName: string;
};

export type ChildcareAssignment = {
  id: string;
  date: string; // YYYY-MM-DD
  assignmentType: "dropoff" | "pickup";
  assignedPersonId: string;
  assignedPersonName: string;
};

export type DailyMealPlan = {
  id: string;
  date: string; // YYYY-MM-DD
  recipeId: string | null;
  recipeName: string | null;
  customTitle: string | null;
  title: string | null;
  note: string | null;
};

export type RecipeOption = {
  id: string;
  name: string;
};

export type TodayPartnerMessage = {
  text: string;
  updatedAt: string;
  updatedByName: string;
};

export type TomorrowWeather = {
  source: "yr";
  tomorrowDate: string; // YYYY-MM-DD in Europe/Oslo
  locationLabel: string;
  isRainExpected: boolean;
  maxPrecipMm: number;
  symbolCode?: string;
  minTempC?: number;
  maxTempC?: number;
  error?: string;
};
