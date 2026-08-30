import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/features/household/queries";

export type InspectionCheckpoint = {
  id: string;
  category: string;
  title: string;
  guidance: string | null;
  checkedAt: string | null;
  note: string | null;
  photos: InspectionPhoto[];
};

export type InspectionPhoto = {
  id: string;
  url: string;
  fileName: string;
  caption: string | null;
};

export type InspectionRoom = {
  id: string;
  name: string;
  area: "ground_floor" | "upper_floor" | "outdoor_storage";
  checkpoints: InspectionCheckpoint[];
};

export type InspectionData = {
  id: string;
  name: string;
  address: string | null;
  date: string;
  rooms: InspectionRoom[];
};

export async function getLatestInspection(): Promise<InspectionData | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;

  const supabase = createAdminSupabaseClient();
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, name, property_address, inspection_date")
    .eq("household_id", membership.householdId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!inspection) return null;

  const { data: rooms } = await supabase
    .from("inspection_rooms")
    .select("id, name, area")
    .eq("inspection_id", inspection.id)
    .order("sort_order");
  const roomIds = (rooms ?? []).map((room) => room.id);
  const { data: checkpoints } = roomIds.length
    ? await supabase
        .from("inspection_checkpoints")
        .select("id, room_id, category, title, guidance, checked_at, note")
        .in("room_id", roomIds)
        .order("sort_order")
    : { data: [] };
  const checkpointIds = (checkpoints ?? []).map((checkpoint) => checkpoint.id);
  const { data: photos } = checkpointIds.length
    ? await supabase
        .from("inspection_photos")
        .select("id, checkpoint_id, storage_path, file_name, caption")
        .in("checkpoint_id", checkpointIds)
        .order("created_at")
    : { data: [] };
  const { data: signedPhotos } = photos?.length
    ? await supabase.storage.from("inspection-media").createSignedUrls(photos.map((photo) => photo.storage_path), 60 * 60)
    : { data: [] };
  const photoUrlByPath = new Map((signedPhotos ?? []).map((photo) => [photo.path, photo.signedUrl]));

  return {
    id: inspection.id,
    name: inspection.name,
    address: inspection.property_address,
    date: inspection.inspection_date,
    rooms: (rooms ?? []).map((room) => ({
      id: room.id,
      name: room.name,
      area: room.area as InspectionRoom["area"],
      checkpoints: (checkpoints ?? [])
        .filter((checkpoint) => checkpoint.room_id === room.id)
        .map((checkpoint) => ({
          id: checkpoint.id,
          category: checkpoint.category,
          title: checkpoint.title,
          guidance: checkpoint.guidance,
          checkedAt: checkpoint.checked_at,
          note: checkpoint.note,
          photos: (photos ?? [])
            .filter((photo) => photo.checkpoint_id === checkpoint.id)
            .flatMap((photo) => {
              const url = photoUrlByPath.get(photo.storage_path);
              return url ? [{ id: photo.id, url, fileName: photo.file_name, caption: photo.caption }] : [];
            })
        }))
    }))
  };
}