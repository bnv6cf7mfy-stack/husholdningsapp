"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership, getCurrentProfileId } from "@/features/household/queries";

const documentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(["plan", "electrical", "selection", "prospect", "contract", "other"]),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  fileSizeBytes: z.number().int().positive().max(25 * 1024 * 1024)
});

export async function createBallerudDocumentUploadAction(input: unknown) {
  const parsed = documentSchema.safeParse(input);
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!parsed.success || !membership || !profileId) return { ok: false as const };
  const extension = parsed.data.fileName.split(".").pop()?.toLowerCase() ?? "file";
  const storagePath = `${membership.householdId}/${crypto.randomUUID()}.${extension}`;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage.from("ballerud-documents").createSignedUploadUrl(storagePath);
  if (error || !data) return { ok: false as const };
  return { ok: true as const, storagePath, token: data.token };
}

export async function registerBallerudDocumentAction(input: unknown) {
  const parsed = documentSchema.extend({ storagePath: z.string().min(1).max(1000) }).safeParse(input);
  const membership = await getCurrentMembership();
  const profileId = await getCurrentProfileId();
  if (!parsed.success || !membership || !profileId || !parsed.data.storagePath.startsWith(`${membership.householdId}/`)) return { ok: false };
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("ballerud_documents").insert({
    household_id: membership.householdId,
    title: parsed.data.title,
    category: parsed.data.category,
    storage_path: parsed.data.storagePath,
    file_name: parsed.data.fileName,
    content_type: parsed.data.contentType,
    file_size_bytes: parsed.data.fileSizeBytes,
    created_by: profileId
  });
  revalidatePath("/ballerud/dokumenter");
  return { ok: !error };
}

export async function deleteBallerudDocumentAction(documentId: string) {
  const membership = await getCurrentMembership();
  if (!membership || !z.string().uuid().safeParse(documentId).success) return { ok: false };
  const supabase = createAdminSupabaseClient();
  const { data: document } = await supabase
    .from("ballerud_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("household_id", membership.householdId)
    .maybeSingle();
  if (!document) return { ok: false };

  const { error: databaseError } = await supabase
    .from("ballerud_documents")
    .delete()
    .eq("id", documentId)
    .eq("household_id", membership.householdId);
  if (databaseError) return { ok: false };

  await supabase.storage.from("ballerud-documents").remove([document.storage_path]);
  revalidatePath("/ballerud/dokumenter");
  return { ok: true };
}