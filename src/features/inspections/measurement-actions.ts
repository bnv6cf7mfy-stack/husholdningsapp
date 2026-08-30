"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";

const measurementSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  lengthCm: z.number().positive().nullable(),
  widthCm: z.number().positive().nullable(),
  heightCm: z.number().positive().nullable(),
  depthCm: z.number().positive().nullable(),
  note: z.string().trim().max(3000)
});

const measurementPhotoSchema = z.object({
  measurementId: z.string().uuid(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024)
});

export async function createInspectionMeasurementAction(input: unknown) {
  const parsed = measurementSchema.safeParse(input);
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!parsed.success || !membership || !profileId) return { ok: false as const };
  const supabase = createAdminSupabaseClient();
  const { data: room } = await supabase
    .from("inspection_rooms")
    .select("inspection_id")
    .eq("id", parsed.data.roomId)
    .eq("household_id", membership.householdId)
    .maybeSingle();
  if (!room) return { ok: false as const };
  const { data, error } = await supabase.from("inspection_measurements").insert({
    household_id: membership.householdId,
    inspection_id: room.inspection_id,
    room_id: parsed.data.roomId,
    name: parsed.data.name,
    length_cm: parsed.data.lengthCm,
    width_cm: parsed.data.widthCm,
    height_cm: parsed.data.heightCm,
    depth_cm: parsed.data.depthCm,
    note: parsed.data.note || null,
    created_by: profileId
  }).select("id").single();
  revalidatePath("/ballerud/oppmaling");
  return data && !error ? { ok: true as const, measurementId: data.id } : { ok: false as const };
}

export async function createMeasurementPhotoUploadAction(input: unknown) {
  const parsed = measurementPhotoSchema.safeParse(input);
  const membership = await getCurrentMembership();
  if (!parsed.success || !membership) return { ok: false as const };
  const supabase = createAdminSupabaseClient();
  const { data: measurement } = await supabase
    .from("inspection_measurements")
    .select("inspection_id")
    .eq("id", parsed.data.measurementId)
    .eq("household_id", membership.householdId)
    .maybeSingle();
  if (!measurement) return { ok: false as const };
  const extension = parsed.data.contentType.split("/")[1];
  const storagePath = `${membership.householdId}/${measurement.inspection_id}/measurements/${parsed.data.measurementId}.${extension}`;
  const { data, error } = await supabase.storage.from("inspection-media").createSignedUploadUrl(storagePath);
  return data && !error ? { ok: true as const, storagePath, token: data.token } : { ok: false as const };
}

export async function attachMeasurementPhotoAction(input: unknown) {
  const parsed = measurementPhotoSchema.extend({ storagePath: z.string().min(1).max(1000) }).safeParse(input);
  const membership = await getCurrentMembership();
  if (!parsed.success || !membership || !parsed.data.storagePath.startsWith(`${membership.householdId}/`)) return { ok: false };
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("inspection_measurements").update({ photo_path: parsed.data.storagePath })
    .eq("id", parsed.data.measurementId).eq("household_id", membership.householdId);
  revalidatePath("/ballerud/oppmaling");
  return { ok: !error };
}