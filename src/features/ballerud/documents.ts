import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/features/household/queries";

export const documentCategories = {
  plan: "Plantegning",
  electrical: "Elektro",
  selection: "Tilvalg",
  prospect: "Prospekt",
  contract: "Kontrakt",
  other: "Annet"
} as const;

export type DocumentCategory = keyof typeof documentCategories;

export type BallerudDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  fileName: string;
  createdAt: string;
  url: string;
};

export async function getBallerudDocuments(): Promise<BallerudDocument[] | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const supabase = createAdminSupabaseClient();
  const { data: documents } = await supabase
    .from("ballerud_documents")
    .select("id, title, category, storage_path, file_name, created_at")
    .eq("household_id", membership.householdId)
    .order("created_at", { ascending: false });
  const { data: signedUrls } = documents?.length
    ? await supabase.storage.from("ballerud-documents").createSignedUrls(documents.map((document) => document.storage_path), 60 * 60)
    : { data: [] };
  const urls = new Map((signedUrls ?? []).map((document) => [document.path, document.signedUrl]));
  return (documents ?? []).flatMap((document) => {
    const url = urls.get(document.storage_path);
    return url ? [{ id: document.id, title: document.title, category: document.category as DocumentCategory, fileName: document.file_name, createdAt: document.created_at, url }] : [];
  });
}