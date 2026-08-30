import { redirect } from "next/navigation";
import { DocumentArchive } from "@/features/ballerud/components/document-archive";
import { getBallerudDocuments } from "@/features/ballerud/documents";

export default async function BallerudDocumentsPage() {
  const documents = await getBallerudDocuments();
  if (!documents) redirect("/onboarding");
  return <DocumentArchive documents={documents} />;
}