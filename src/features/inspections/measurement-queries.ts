import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/features/household/queries";

export type InspectionMeasurement = {
  id: string;
  name: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  note: string | null;
  photoUrl: string | null;
};

export type MeasurementRoom = {
  id: string;
  name: string;
  code: string;
  area: "ground_floor" | "upper_floor" | "outdoor_storage";
  measurements: InspectionMeasurement[];
};

export type MeasurementData = {
  inspectionId: string;
  rooms: MeasurementRoom[];
};

export async function getInspectionMeasurementData(): Promise<MeasurementData | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const supabase = createAdminSupabaseClient();
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id")
    .eq("household_id", membership.householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!inspection) return null;
  const { data: rooms } = await supabase
    .from("inspection_rooms")
    .select("id, name, code, area")
    .eq("inspection_id", inspection.id)
    .order("sort_order");
  const roomIds = (rooms ?? []).map((room) => room.id);
  const { data: measurements } = roomIds.length
    ? await supabase
        .from("inspection_measurements")
        .select("id, room_id, name, length_cm, width_cm, height_cm, depth_cm, note, photo_path")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const photoPaths = (measurements ?? []).flatMap((measurement) => measurement.photo_path ? [measurement.photo_path] : []);
  const { data: signedPhotos } = photoPaths.length
    ? await supabase.storage.from("inspection-media").createSignedUrls(photoPaths, 60 * 60)
    : { data: [] };
  const photoUrls = new Map((signedPhotos ?? []).map((photo) => [photo.path, photo.signedUrl]));

  return {
    inspectionId: inspection.id,
    rooms: (rooms ?? []).map((room) => ({
      id: room.id,
      name: room.name,
      code: room.code,
      area: room.area as MeasurementRoom["area"],
      measurements: (measurements ?? []).filter((measurement) => measurement.room_id === room.id).map((measurement) => ({
        id: measurement.id,
        name: measurement.name,
        lengthCm: measurement.length_cm,
        widthCm: measurement.width_cm,
        heightCm: measurement.height_cm,
        depthCm: measurement.depth_cm,
        note: measurement.note,
        photoUrl: measurement.photo_path ? photoUrls.get(measurement.photo_path) ?? null : null
      }))
    }))
  };
}