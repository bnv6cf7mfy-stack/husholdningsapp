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
