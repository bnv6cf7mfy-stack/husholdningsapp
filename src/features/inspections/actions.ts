"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";
import { ballerudInspectionTemplate } from "@/features/inspections/template";

const photoUploadSchema = z.object({
  checkpointId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024)
});

const areaByRoomCode: Record<string, "ground_floor" | "upper_floor" | "outdoor_storage"> = {
  SOV2: "upper_floor", SOV3: "upper_floor", BAD: "upper_floor",
  TERR: "outdoor_storage", HAGE: "outdoor_storage", FASADE: "outdoor_storage", BOD: "outdoor_storage", TEKN: "outdoor_storage"
};

const supplementaryCheckpointsByRoomCode: Record<string, Array<{ category: string; title: string }>> = {
  GANG: [{ category: "Elektro", title: "Kontroller ringeklokke, røykdetektor og lampepunkt ved inngang" }],
  KJ: [
    { category: "Elektro", title: "Kontroller 14 avtalte ekstra punkter, plassering og riktig type stikk" },
    { category: "Elektro", title: "Kontroller lampepunkt og dimmer over kjøkkenøy" },
    { category: "Elektro", title: "Kontroller lampepunkt for spisebord og riktig plassering ved innredning" }
  ],
  STUE: [{ category: "Elektro", title: "Kontroller stikk, takpunkt og downlights mot tilvalgstegning" }],
  TRAPP: [{ category: "Elektro", title: "Kontroller lampepunkt over trapp, endevender og lysdemper" }],
  SOV1: [{ category: "Elektro", title: "Kontroller avtalte takpunkt og stikk i soverom" }],
  SOV2: [{ category: "Elektro", title: "Kontroller avtalte takpunkt og stikk i soverom" }],
  SOV3: [{ category: "Elektro", title: "Kontroller avtalte takpunkt og stikk i soverom" }],
  BAD: [{ category: "Elektro", title: "Kontroller downlights, termostat, ventilasjonspanel og IP-klassifiserte punkter" }],
  TEKN: [{ category: "Elektro", title: "Kontroller sikringsskap mot kursfortegnelse og at hver kurs er merket" }]
};

export async function createBallerudInspectionAction() {
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!membership || !profileId) return;
  const supabase = createAdminSupabaseClient();
  const { data: inspection, error } = await supabase
    .from("inspections")
    .insert({
      household_id: membership.householdId,
      name: "Ferdigbefaring Ballerud",
      property_address: "Ballerud Hageby, rekkehus 111",
      inspection_type: "Ferdigbefaring",
      created_by: profileId
    })
    .select("id")
    .single();
  if (error || !inspection) return;

  const { data: rooms } = await supabase
    .from("inspection_rooms")
    .insert(
      ballerudInspectionTemplate.map((room, index) => ({
        inspection_id: inspection.id,
        household_id: membership.householdId,
        name: room.name,
        code: room.code,
        area: areaByRoomCode[room.code] ?? "ground_floor",
        sort_order: index
      }))
    )
    .select("id, code");
  const roomIdsByCode = new Map((rooms ?? []).map((room) => [room.code, room.id]));
  const checkpoints = ballerudInspectionTemplate.flatMap((room) =>
    [...room.checkpoints, ...(supplementaryCheckpointsByRoomCode[room.code] ?? [])].map((checkpoint, index) => ({
      inspection_id: inspection.id,
      room_id: roomIdsByCode.get(room.code),
      household_id: membership.householdId,
      ...checkpoint,
      sort_order: index
    }))
  );
  await supabase.from("inspection_checkpoints").insert(checkpoints);
  revalidatePath("/ferdigbefaring");
}

export async function updateInspectionCheckpointAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const checked = formData.get("checked") === "true";
  const note = String(formData.get("note") ?? "").trim().slice(0, 3000);
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!membership || !profileId || !id) return { ok: false };
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("inspection_checkpoints")
    .update({ checked_at: checked ? new Date().toISOString() : null, checked_by: checked ? profileId : null, note: note || null })
    .eq("id", id)
    .eq("household_id", membership.householdId);
  revalidatePath("/ferdigbefaring");
  return { ok: !error };
}

export async function createInspectionPhotoUploadAction(input: unknown) {
  const parsed = photoUploadSchema.safeParse(input);
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!parsed.success || !membership || !profileId) return { ok: false as const };
  const supabase = createAdminSupabaseClient();
  const { data: checkpoint } = await supabase
    .from("inspection_checkpoints")
    .select("inspection_id")
    .eq("id", parsed.data.checkpointId)
    .eq("household_id", membership.householdId)
    .maybeSingle();
  if (!checkpoint) return { ok: false as const };

  const extension = parsed.data.contentType.split("/")[1];
  const storagePath = `${membership.householdId}/${checkpoint.inspection_id}/${parsed.data.checkpointId}/${crypto.randomUUID()}.${extension}`;
  const { data: upload, error } = await supabase.storage.from("inspection-media").createSignedUploadUrl(storagePath);
  if (error || !upload) return { ok: false as const };
  return { ok: true as const, token: upload.token, storagePath, inspectionId: checkpoint.inspection_id, profileId };
}

export async function registerInspectionPhotoAction(input: unknown) {
  const parsed = photoUploadSchema.extend({ storagePath: z.string().min(1).max(1000) }).safeParse(input);
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!parsed.success || !membership || !profileId) return { ok: false };
  const supabase = createAdminSupabaseClient();
  const { data: checkpoint } = await supabase
    .from("inspection_checkpoints")
    .select("inspection_id")
    .eq("id", parsed.data.checkpointId)
    .eq("household_id", membership.householdId)
    .maybeSingle();
  if (!checkpoint || !parsed.data.storagePath.startsWith(`${membership.householdId}/${checkpoint.inspection_id}/${parsed.data.checkpointId}/`)) return { ok: false };
  const { error } = await supabase.from("inspection_photos").insert({
    household_id: membership.householdId,
    inspection_id: checkpoint.inspection_id,
    checkpoint_id: parsed.data.checkpointId,
    storage_path: parsed.data.storagePath,
    file_name: parsed.data.fileName,
    content_type: parsed.data.contentType,
    file_size_bytes: parsed.data.fileSizeBytes,
    created_by: profileId
  });
  revalidatePath("/ferdigbefaring");
  return { ok: !error };
}