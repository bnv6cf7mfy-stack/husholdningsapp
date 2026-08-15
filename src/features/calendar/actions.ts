"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { calendarEventTypeLabels } from "@/features/calendar/types";

const calendarEventTypeValues = Object.keys(calendarEventTypeLabels) as [
  "general",
  "child",
  "family",
  "appointment",
  "work",
  "activity",
  "other"
];

const createCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(240),
    eventType: z.enum(calendarEventTypeValues),
    date: z.string().trim().min(1),
    startTime: z.string().trim().optional(),
    endTime: z.string().trim().optional(),
    allDay: z.boolean(),
    location: z.string().trim().max(200).optional(),
    description: z.string().trim().max(800).optional(),
    childIds: z.array(z.string().uuid()).default([])
  })
  .superRefine((data, ctx) => {
    if (!data.allDay) {
      if (!data.startTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mangler starttid", path: ["startTime"] });
      }

      if (!data.endTime) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mangler sluttid", path: ["endTime"] });
      }
    }
  });

async function resolveCalendarContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data: membership } = await adminSupabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", profile.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  return {
    householdId: membership.household_id,
    profileId: profile.id
  };
}

function buildDateTimes(date: string, startTime?: string, endTime?: string, allDay?: boolean) {
  if (allDay) {
    return {
      startsAt: new Date(`${date}T00:00:00`).toISOString(),
      endsAt: new Date(`${date}T23:59:00`).toISOString()
    };
  }

  const startsAt = new Date(`${date}T${startTime ?? "00:00"}:00`);
  const endsAt = new Date(`${date}T${endTime ?? "00:00"}:00`);

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString()
  };
}

export async function createCalendarEventAction(formData: FormData) {
  const parsed = createCalendarEventSchema.safeParse({
    title: formData.get("title"),
    eventType: formData.get("eventType"),
    date: formData.get("date"),
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
    allDay: formData.get("allDay") === "on",
    location: formData.get("location") || undefined,
    description: formData.get("description") || undefined,
    childIds: formData.getAll("childIds")
  });

  if (!parsed.success) {
    revalidatePath("/calendar");
    return;
  }

  const context = await resolveCalendarContext();

  if (!context) {
    revalidatePath("/calendar");
    return;
  }

  const { startsAt, endsAt } = buildDateTimes(
    parsed.data.date,
    parsed.data.startTime,
    parsed.data.endTime,
    parsed.data.allDay
  );

  if (new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    revalidatePath("/calendar");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: createdEvent } = await adminSupabase
    .from("calendar_events")
    .insert({
      household_id: context.householdId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      starts_at: startsAt,
      ends_at: endsAt,
      all_day: parsed.data.allDay,
      event_type: parsed.data.eventType,
      location: parsed.data.location || null,
      created_by: context.profileId
    })
    .select("id")
    .maybeSingle();

  if (createdEvent?.id && parsed.data.childIds.length > 0) {
    const linkRows = parsed.data.childIds.map((childId) => ({
      calendar_event_id: createdEvent.id,
      child_id: childId,
      household_id: context.householdId
    }));

    await adminSupabase.from("calendar_event_children").insert(linkRows);
  }

  revalidatePath("/calendar");
}

const saveChildcareWeekSchema = z.object({
  // week start date as YYYY-MM-DD (Monday)
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // For each weekday (0=Mon..4=Fri), dropoff and pickup person profile IDs
  // Encoded as "dayIndex:dropoffProfileId" and "dayIndex:pickupProfileId" multi-values
  dropoff: z.array(z.string()).default([]),
  pickup: z.array(z.string()).default([])
});

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function saveChildcareWeekAction(formData: FormData) {
  const parsed = saveChildcareWeekSchema.safeParse({
    weekStart: formData.get("weekStart"),
    dropoff: formData.getAll("dropoff"),
    pickup: formData.getAll("pickup")
  });

  if (!parsed.success) {
    revalidatePath("/calendar");
    return;
  }

  const context = await resolveCalendarContext();

  if (!context) {
    revalidatePath("/calendar");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  // Parse "dayIndex:profileId" pairs
  const parseEntries = (entries: string[]) =>
    entries
      .map((entry) => {
        const [dayStr, profileId] = entry.split(":");
        const day = Number(dayStr);
        return { day, profileId };
      })
      .filter(({ day, profileId }) => !Number.isNaN(day) && profileId && profileId.trim().length > 0);

  const dropoffEntries = parseEntries(parsed.data.dropoff);
  const pickupEntries = parseEntries(parsed.data.pickup);

  // Delete existing assignments for the 5 weekdays in this week
  const dates = [0, 1, 2, 3, 4].map((offset) => addDays(parsed.data.weekStart, offset));

  await adminSupabase
    .from("childcare_assignments")
    .delete()
    .eq("household_id", context.householdId)
    .in("date", dates);

  const insertRows = [
    ...dropoffEntries.map(({ day, profileId }) => ({
      household_id: context.householdId,
      date: addDays(parsed.data.weekStart, day),
      assignment_type: "dropoff" as const,
      assigned_person_id: profileId,
      created_by: context.profileId
    })),
    ...pickupEntries.map(({ day, profileId }) => ({
      household_id: context.householdId,
      date: addDays(parsed.data.weekStart, day),
      assignment_type: "pickup" as const,
      assigned_person_id: profileId,
      created_by: context.profileId
    }))
  ].filter((row) => row.assigned_person_id.trim().length > 0);

  if (insertRows.length > 0) {
    await adminSupabase.from("childcare_assignments").insert(insertRows);
  }

  revalidatePath("/calendar");
}

const saveCalendarDayDetailsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dropoffProfileId: z.string().uuid().optional().or(z.literal("")),
  pickupProfileId: z.string().uuid().optional().or(z.literal("")),
  dinnerTitle: z.string().trim().max(160).optional(),
  dinnerNote: z.string().trim().max(800).optional()
});

export async function saveCalendarDayDetailsAction(formData: FormData) {
  const parsed = saveCalendarDayDetailsSchema.safeParse({
    date: formData.get("date"),
    dropoffProfileId: formData.get("dropoffProfileId") || "",
    pickupProfileId: formData.get("pickupProfileId") || "",
    dinnerTitle: formData.get("dinnerTitle") || undefined,
    dinnerNote: formData.get("dinnerNote") || undefined
  });

  if (!parsed.success) {
    revalidatePath("/calendar");
    return;
  }

  const context = await resolveCalendarContext();

  if (!context) {
    revalidatePath("/calendar");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: memberRows } = await adminSupabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", context.householdId);

  const validMemberIds = new Set((memberRows ?? []).map((row) => row.user_id));

  const dropoffProfileId =
    parsed.data.dropoffProfileId && validMemberIds.has(parsed.data.dropoffProfileId)
      ? parsed.data.dropoffProfileId
      : null;
  const pickupProfileId =
    parsed.data.pickupProfileId && validMemberIds.has(parsed.data.pickupProfileId)
      ? parsed.data.pickupProfileId
      : null;

  await adminSupabase
    .from("childcare_assignments")
    .delete()
    .eq("household_id", context.householdId)
    .eq("date", parsed.data.date);

  const childcareRows: Array<{
    household_id: string;
    date: string;
    assignment_type: "dropoff" | "pickup";
    assigned_person_id: string;
    created_by: string;
  }> = [];

  if (dropoffProfileId) {
    childcareRows.push({
      household_id: context.householdId,
      date: parsed.data.date,
      assignment_type: "dropoff",
      assigned_person_id: dropoffProfileId,
      created_by: context.profileId
    });
  }

  if (pickupProfileId) {
    childcareRows.push({
      household_id: context.householdId,
      date: parsed.data.date,
      assignment_type: "pickup",
      assigned_person_id: pickupProfileId,
      created_by: context.profileId
    });
  }

  if (childcareRows.length > 0) {
    await adminSupabase.from("childcare_assignments").insert(childcareRows);
  }

  await adminSupabase
    .from("meal_plans")
    .delete()
    .eq("household_id", context.householdId)
    .eq("meal_type", "dinner")
    .eq("meal_date", parsed.data.date);

  const dinnerTitle = parsed.data.dinnerTitle?.trim() ?? "";
  const dinnerNote = parsed.data.dinnerNote?.trim() ?? "";

  if (dinnerTitle || dinnerNote) {
    await adminSupabase.from("meal_plans").insert({
      household_id: context.householdId,
      meal_date: parsed.data.date,
      meal_type: "dinner",
      custom_title: dinnerTitle || null,
      note: dinnerNote || null,
      created_by: context.profileId
    });
  }

  revalidatePath("/calendar");
}

export async function archiveCalendarEventAction(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");

  if (!eventId) {
    revalidatePath("/calendar");
    return;
  }

  const context = await resolveCalendarContext();

  if (!context) {
    revalidatePath("/calendar");
    return;
  }

  const adminSupabase = createAdminSupabaseClient();

  await adminSupabase
    .from("calendar_events")
    .update({
      archived_at: new Date().toISOString()
    })
    .eq("id", eventId)
    .eq("household_id", context.householdId)
    .is("archived_at", null);

  revalidatePath("/calendar");
}
